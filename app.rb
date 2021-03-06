# encoding: utf-8

require 'sinatra'
require 'sinatra/reloader' if development?
require 'sinatra/activerecord'
require 'redcarpet'
require 'sinatra/json'
require 'qiniu-rs'
require 'roo'
require 'date'

configure :development do
  set :public_folder, File.dirname(__FILE__) + '/public/src/'
  set :random, (Time.now.to_f * 1000).to_i.to_s
end

configure :production do
  set :public_folder, File.dirname(__FILE__) + '/public/dist/'
  set :random, (Time.now.to_f * 1000).to_i.to_s
  set :static_cache_control, [:public, :max_age => 3600*24*30*6]
end

Qiniu::RS.establish_connection! :access_key => '4drJ2mqHlMuy1sXSfd7W9KYQj3Z9iBAWUZ5kC-9g',
                                :secret_key => '75lbFP5RQIjkZAlcnAGdKIOyxJlPuxVCsAoBLEXj'

class Song < ActiveRecord::Base
end

class Resource < ActiveRecord::Base
  belongs_to :user
end

class User < ActiveRecord::Base
  has_many :resource
end

class Meeting < ActiveRecord::Base
end

class MeetingSong < ActiveRecord::Base
end

# use Rack::Session::Pool, :expire_after => 2592000
use Rack::Session::Cookie, :key => 'rack.session',
                           :expire_after => 2592000, # In seconds
                           :secret => '1050'

### utils start

def encode_object(obj)
  if obj
    obj.attributes.each do |key, value|
      if obj[key].is_a? String
        obj[key].force_encoding('UTF-8')
      end
    end
  end
  obj
end

def encode_list(list)
  list.each do |obj|
    obj = encode_object(obj)
  end
  list
end

def save_object(obj, data)
  if obj
    obj.attributes.each do |key, value|
      if key != 'id'
        if data[key]
          obj[key] = data[key]
        end
      end
    end
    obj.save
  else
    return false
  end
end

### utils end

get '/dev-blog' do
  markdown :dev_blog, :layout_engine => :erb, :layout => :dev_blog_layout
end

get '/songs' do
  @song = Song.order('updated_at DESC').first
  @etag = @song.updated_at.to_s + '/' + Song.count.to_s
  last_modified @etag
  etag @etag
  songs = Song.all.order('`index`')
  json encode_list(songs)
end

def get_resources_with_user_info(resources)
  resources_with_user_info = []
  resources.each do |resource|
    hash = {}
    resource.attributes.each do |key, value|
      hash[key] = value
    end
    hash[:nickname] = resource.user ? resource.user.nickname.force_encoding('UTF-8') : nil
    hash[:figure_url] = resource.user ? resource.user.figure_url.force_encoding('UTF-8') : nil
    resources_with_user_info.push(hash)
  end
  resources_with_user_info
end

get '/songs/:id' do
  song = Song.find_by_id(params[:id].to_i)
  resources = get_resources_by_song_id(params[:id].to_i)
  if song
    re = encode_object(song).attributes
    re['resources'] = get_resources_with_user_info(encode_list(resources))
    json re
  else
    re = { :error => true }
    json re
  end
end

# Deprecated. Because we have frontRestful.
# get '/songs_category/:category_name' do
#   songs = Song.where('category_big = ?', params[:category_name]).order('`index`')
#   json encode_list(songs)
# end

# Deprecated. Because we have frontRestful.
# get '/songs_search/:keywords' do
#   keywords = params[:keywords].force_encoding('UTF-8')
#   if(keywords.to_i != 0)
#     song = Song.find_by_index(keywords.to_i)
#     json encode_object(song)
#   else
#     songs = Song.where('name like ? or first_sentence like ?', "%#{keywords}%", "%#{keywords}%").order('`index`')
#     json encode_list(songs)
#   end
# end

get '/search' do
  redirect to("/search/#{URI.escape(params[:keywords])}")
end

get '/songs_filter/:type' do
  id_list = []

  if params[:type] == 'guess'
    id_list_from_user = []
    id_list_from_random = []

    if !session[:user_id].nil?
      meeting_ids = []
      song_ids = []
      song_hash = {}
      Meeting.where('user_id = ?', session[:user_id].to_i).select('id').to_a.each { |obj| meeting_ids.push(obj.id) }
      MeetingSong.where(meeting_id: meeting_ids).select('song_id').distinct.to_a.each { |obj| song_ids.push(obj.song_id) }
      Song.where(id: song_ids).select('category_small, count(*) as counts').group('category_small').order('counts DESC').to_a.each { |obj| song_hash[obj.category_small.force_encoding('UTF-8')] = obj.counts }

      category_small_list = ((Hash[song_hash.sort_by { |k, v| v }.reverse]).keys).take(5)

      Song.where(category_small: category_small_list).select('id').limit(15).order('RAND()').to_a.each { |obj| id_list_from_user.push(obj.id) }
    end
    Song.select('id').limit(20).order('RAND()').to_a.each { |obj| id_list_from_random.push(obj.id) }

    id_list = (id_list_from_user + id_list_from_random).take(20)
  elsif params[:type] == 'top'
    resource_hash = {}
    meeting_hash = {}
    (Resource.where('file_type = "song" and stars > 0').select('song_id, sum(stars) as counts').group('song_id').order('counts DESC')).to_a.each { |obj| resource_hash[obj.song_id] = obj.counts }
    (MeetingSong.select('song_id, count(*) as counts').group('song_id').order('counts DESC')).to_a.each { |obj| meeting_hash[obj.song_id] = obj.counts }

    hash = resource_hash.clone
    meeting_hash.each do |key, value|
      if resource_hash.has_key? key
        hash[key] += value
      else
        hash[key] = value
      end
    end

    id_list = ((Hash[hash.sort_by { |k, v| v }.reverse]).keys).take(100)
  end

  songs = Song.find(id_list)
  json encode_list(songs)
end

def add_resources(resources, song_id)
  if(resources.length>0)
    resources.each do |obj|
      current_resource = Resource.where('song_id = ? and file_name = ?', song_id, obj['file_name'])
      if(current_resource.count == 0)
        new_resource = Resource.new
        new_resource.attributes.each do |key, value|
          if key != 'id'
            if obj[key]
              new_resource[key] = obj[key]
            end
          end
        end
        new_resource['song_id'] = song_id
        new_resource['stars'] = 0
        if !session[:user_id].nil?
          new_resource['user_id'] = session[:user_id].to_i
        end
        new_resource.save
      end
    end
  end
  get_resources_by_song_id(song_id)
end

def get_resources_by_song_id(song_id)
  resources = Resource.includes(:user).where('song_id = ?', song_id).order('stars DESC')
end

put '/songs/:id' do
  request.body.rewind  # in case someone already read it
  data = JSON.parse request.body.read
  song = Song.find_by_id(params[:id].to_i)
  if(save_object(song, data))
    resources = add_resources(data['resources'], song.id)

    src = get_most_starred_resource_src_by_song_id(song.id)
    update_song_src_by_song_id(src, song.id)

    re = encode_object(song).attributes
    re['resources'] = get_resources_with_user_info(encode_list(resources))
    json re
  else
    re = { :error => true }
    json re
  end
end

post '/songs' do
  request.body.rewind  # in case someone already read it
  data = JSON.parse request.body.read
  song = Song.new
  if(save_object(song, data))
    resources = add_resources(data['resources'], song.id)

    src = get_most_starred_resource_src_by_song_id(song.id)
    update_song_src_by_song_id(src, song.id)

    re = encode_object(song).attributes
    re['resources'] = get_resources_with_user_info(encode_list(resources))
    json re
  else
    re = { :error => true }
    json re
  end
end

delete '/songs/:id' do
  param = (params[:id]).to_i
  resources = get_resources_by_song_id(param)
  resources.each do |resource|
    delete_resource_from_cloud_by_resource_key(resource['file_name'])
    resource.delete
  end
  json Song.delete(param)
end

delete '/resources/:id' do
  param = (params[:id]).to_i
  resource = Resource.find_by_id(param)
  delete_resource_from_cloud_by_resource_key(resource['file_name'])
  if resource.delete
    src = get_most_starred_resource_src_by_song_id(resource['song_id'])
    update_song_src_by_song_id(src, resource['song_id'])
    json true
  end
end

patch '/resources/:id' do
  request.body.rewind  # in case someone already read it
  data = JSON.parse request.body.read
  obj = data
  resource = Resource.find_by_id(params[:id].to_i)
  if resource
    resource.attributes.each do |key, value|
      if key != 'id'
        if obj[key]
          resource[key] = obj[key]
        end
      end
    end
    if obj['plus']
      resource['stars'] += obj['plus'].to_i
    end
    resource.save

    src = get_most_starred_resource_src_by_song_id(resource['song_id'])
    update_song_src_by_song_id(src, resource['song_id'])

    re = encode_object(resource).attributes
    json re
  else
    re = { :error => true }
    json re
  end
end

def get_most_starred_resource_src_by_song_id(song_id)
  src = {}
  resources = Resource.where('song_id = ?', song_id).order('stars DESC')
  t = encode_object(resources.where('file_type = ?', 'song').first)
  src['song_src'] = t ? t['file_name'] : nil
  t = encode_object(resources.where('file_type = ?', 'pic').first)
  src['pic_src'] = t ? t['file_name'] : nil
  src
end

def update_song_src_by_song_id(src, song_id)
  song = Song.find_by_id(song_id)
  if song
    song['song_src'] = src['song_src']
    song['pic_src'] = src['pic_src']
    song.save
  end
end

def delete_resource_from_cloud_by_resource_key(resource_key)
  Qiniu::RS.delete('production-1050', resource_key)
end

### import start

get '/interface' do
  erb :interface
end

post '/interface' do
  msg = "请选择Excel文件！<a href='/interface'>返回重试</a>"
  if(params[:song_file])
    path = 'uploads/' + params[:song_file][:filename]
    extension = path.slice(path.index('.'), path.length - path.index('.'))
    if(extension == '.xlsx' || extension == '.xls')
      File.open(path, "wb") do |f|
        f.write(params[:song_file][:tempfile].read)
      end
      renamed_path = 'uploads/' + (Time.now.to_f * 1000).to_i.to_s + '_' + params[:song_file][:filename]
      File.rename(path, renamed_path)
      if import_songs_from_excel(renamed_path, extension)
        msg = "恭喜，诗歌导入成功！<a href='/interface'>返回</a>"
      else
        "操作失败！<a href='/interface'>返回重试</a>"
      end
    else
      msg = "只支持Excel文件！<a href='/interface'>返回重试</a>"
    end
  end
  if(params[:resource_file])
    path = 'uploads/' + params[:resource_file][:filename]
    extension = path.slice(path.index('.'), path.length - path.index('.'))
    if(extension == '.xlsx' || extension == '.xls')
      File.open(path, "wb") do |f|
        f.write(params[:resource_file][:tempfile].read)
      end
      renamed_path = 'uploads/' + (Time.now.to_f * 1000).to_i.to_s + '_' + params[:resource_file][:filename]
      File.rename(path, renamed_path)
      if import_resources_from_excel(renamed_path, extension)
        msg = "恭喜，资源导入成功！<a href='/interface'>返回</a>"
      else
        "操作失败！<a href='/interface'>返回重试</a>"
      end
    else
      msg = "只支持Excel文件！<a href='/interface'>返回重试</a>"
    end
  end
  msg
end

def read_excel(path, extension)
  if(extension == '.xlsx')
    s = Roo::Excelx.new(path)
  elsif(extension == '.xls')
    s = Roo::Excel.new(path)
  end
  s.default_sheet = s.sheets.first
  s
end

def convert_excel_to_list(s, attr_array)
  list = []
  2.upto(s.last_row) do |row|
    obj = {}
    attr_array.length.times do |i|
      obj[attr_array[i]] = (s.cell(row, i+1)).to_s
    end
    obj = reset_obj_attr(obj)
    if is_obj_pass_condition?(obj)
      list.push(obj)
    end
  end
  list
end

def reset_obj_attr(obj)
  if(obj['index'])
    obj['index'] = obj['index'].to_i
  end
  obj
end

def is_obj_pass_condition?(obj)
  if(obj['index'])
    if (obj['index'] > 0) && !(obj['name'].strip.empty?)
      return true
    end
    return false
  end
  return true
end

def import_songs_from_excel(path, extension)
  attr_array = ['index', 'name', 'first_sentence', 'category_big', 'category_small', 'song_src', 'pic_src']
  s = read_excel(path, extension)
  list = convert_excel_to_list(s, attr_array)

  list.each do |obj|
    song = Song.find_by_index(obj['index'].to_i)
    if(!song)
      song = Song.new
    end
    song.attributes.each do |key, value|
      if obj[key]
        song[key] = obj[key]
      end
    end
    song.save
  end

  return true
end

def import_resources_from_excel(path, extension)
  attr_array = ['name', 'file_name', 'file_size', 'file_type']
  s = read_excel(path, extension)
  list = convert_excel_to_list(s, attr_array)

  list.each do |obj|
    song = Song.find_by_name(obj['name'].force_encoding("UTF-8"))
    if(song)
      resource = Resource.where('song_id = ? and file_name = ?', song['id'], obj['file_name'].force_encoding("UTF-8"))
      if(resource.count == 0)
        resource = Resource.new
        resource.attributes.each do |key, value|
          if(obj[key] && obj[key] != 'name')
            resource[key] = obj[key]
          end
          resource['song_id'] = song['id']
          resource['stars'] = 0
        end
        resource.save
      end
    end
  end

  return true
end

### import end

### login start

def get_user(p)
  user = User.find_by_open_id(p[:open_id])
  if(!user)
    user = User.new
  end
  user.open_id = p[:open_id]
  user.nickname = p[:nickname]
  user.figure_url = p[:figure_url]
  user.save
  user
end

get '/login' do
  erb :login
end

post '/login' do
  p = {
    :open_id => params[:open_id],
    :nickname => params[:nickname],
    :figure_url => params[:figure_url]
  }
  user = get_user(p)
  session[:user_id] = user.id
  session[:nickname] = user.nickname.force_encoding('UTF-8')
  session[:figure_url] = user.figure_url.force_encoding('UTF-8')
  re = { :error => false }
  json re
end

post '/logout' do
  session.clear
  re = { :error => false }
  json re
end

### login end

### meeting start

post '/meetingSongs' do
  request.body.rewind  # in case someone already read it
  data = JSON.parse request.body.read
  if(!session[:user_id].nil?)
    current_meeting = Meeting.where("user_id = ? and status = 'current'", session[:user_id]).take
    if(!current_meeting)
      current_meeting = init_meeting()
    end
    data['meeting_id'] = current_meeting.id
    meeting_song = MeetingSong.new
    if(save_object(meeting_song, data))
      json encode_object(meeting_song)
    else
      re = { :error => true }
      json re
    end
  end
end

def init_meeting
  meeting = Meeting.new
  meeting['date'] = (Date.today + (7 - Date.today.wday)).to_s
  meeting['info'] = '主日礼拜聚会'
  meeting['user_id'] = session[:user_id]
  meeting['status'] = 'current'
  meeting.save
  meeting
end

get '/meetings/:user_id' do
  if(!session[:user_id].nil?)
    meetings = Meeting.where('user_id = ?', params[:user_id]).order('id DESC')
    json attach_meetings_with_its_songs(encode_list(meetings))
  end
end

def attach_meetings_with_its_songs(meetings)
  attached_meetings = []
  meetings.each do |meeting|
    hash = {}
    meeting.attributes.each do |key, value|
      hash[key] = value
    end
    hash[:meeting_songs] = attach_meeting_songs_with_song_info(MeetingSong.where('meeting_id = ?', meeting.id))
    attached_meetings.push(hash)
  end
  attached_meetings
end

def attach_meeting_songs_with_song_info(meeting_songs)
  attached_meeting_songs = []
  meeting_songs.each do |meeting_song|
    hash = {}
    meeting_song.attributes.each do |key, value|
      hash[key] = value
    end
    hash[:song] = encode_object(Song.find_by_id(meeting_song.song_id))
    attached_meeting_songs.push(hash)
  end
  attached_meeting_songs
end

delete '/meetingSongs/:id' do
  param = (params[:id]).to_i
  json MeetingSong.delete(param)
end

put '/meetings/:id' do
  request.body.rewind  # in case someone already read it
  data = JSON.parse request.body.read
  meeting = Meeting.find_by_id(params[:id].to_i)
  if(save_object(meeting, data))
    re = encode_object(meeting)
    json re
  else
    re = { :error => true }
    json re
  end
end

delete '/meetings/:id' do
  param = (params[:id]).to_i
  meeting_songs = MeetingSong.where('meeting_id = ?', param)
  meeting_songs.each do |meeting_song|
    meeting_song.delete
  end
  json Meeting.delete(param)
end

### meeting end

get '/announcement' do
  erb :announcement
end

get '*' do
  @token = Qiniu::RS.generate_upload_token :scope => 'production-1050'
  erb :index, :layout => :app_layout
end
