﻿define(['jquery', 'backbone', 'text!app/templates/song-template.html', 'helper', 'utils/utils', 'app/models/resource-model', 'app/views/resource-view', 'app/models/meeting-model', 'plupload/zh_CN', 'utils/config', 'bootstrap', 'bootstrap-waterfall'],

function ($, Backbone, SongTemplate, helper, utils, ResourceModel, ResourceView, MeetingModel, plupload, config) {

var ShowSongView = Backbone.View.extend({

  options: null,

  template: "#ShowSongTemplate",

  initialize: function (options) {
    this.options = options || {};
    this.render();
  },

  render: function () {
    var template = _.template($(SongTemplate).find(this.template).html());
    this.$el.html(template(_.extend({}, this, {app: this.options.app})));
    $("#IndexContainer").empty().html(this.el);
  }

});

var PagerView = Backbone.View.extend({

  options: null,

  curPage: 0,
  totalPage: 0,
  pageSize: 100,
  baseUrl: null,

  curSongsList: null,

  template: "#PagerTemplate",

  initialize: function (options) {
    this.options = options || {};

    this.initPager();
    this.initCurPage();
    this.initBaseUrl();
    this.filterSongs();
    this.render();
  },

  initPager: function () {
    if (this.collection.length > 0) {
      var t = this.collection.length / this.pageSize;
      if (t === parseInt(t, 10)) {
        this.totalPage = t;
      } else {
        this.totalPage = parseInt(t, 10) + 1;
      }
    }
  },

  initCurPage: function () {
    var page = this.options.app.page;
    if (!page) {
      this.curPage = 1;
    } else if (page < 1) {
      this.curPage = 1;
    } else if (page > this.totalPage) {
      this.curPage = this.totalPage;
    } else {
      this.curPage = page;
    }
  },

  initBaseUrl: function () {
    var page = this.options.app.page;
    var url = window.location.pathname;
    if (!page) {
      var endString = url == '/' ? 'p' : '/p';
      this.baseUrl = url + endString;
    } else {
      this.baseUrl = url.slice(0, url.indexOf('/p') + 2);
    }
  },

  filterSongs: function () {
    var t = (this.curPage - 1) * this.pageSize;
    this.curSongsList = _.filter(this.collection.toJSON(), function (obj, index) {
      return index >= t && index < t + this.pageSize;
    }, this);
  },

  render: function () {
    require(['app/models/song-model'], $.proxy(function (SongModel) {
      var template = _.template($(SongTemplate).find(this.template).html());
      this.$el.html(template(this));
      $(".PagerContainer").html(this.$el.html());

      var songsView = new SongsView({collection: new SongModel.Songs(this.curSongsList)});
    }, this));
  }

});

var SongsView = Backbone.View.extend({

  template: "#SongsTemplate",

  initialize: function () {
    this.render();
  },

  render: function () {
    var template = _.template($(SongTemplate).find(this.template).html());
    this.$el.html(template());
    $("#SongsContainer").empty().html(this.el);

    var songsTemplate = _.template($(SongTemplate).find('#waterfall-template').html());
    this.$('.waterfall')
      .data('bootstrap-waterfall-template', songsTemplate(_.extend({}, this, {config: config}, {userId: $("#IndexContainer").attr("user_id")})))
      .waterfall();
  },

  events: {
    'click *[tag="play"]': 'play',
    'click *[tag="add"]': 'add'
  },

  play: function (e) {
    var songId = $(e.currentTarget).closest('*[song_id]').attr('song_id');
    var song = this.collection.get(songId);

    if ((this.viewInUse || (this.viewInUse = {})).playerView) {
      this.viewInUse.playerView.close();
    }
    this.viewInUse.playerView = new PlayerView({model: song});

    this.renderNowPlaying($(e.currentTarget), 'btn-success');
  },

  renderNowPlaying: function ($target, cssName) {
    var $context = $target.closest('#SongsContainer');
    $context.find('a.' + cssName).removeClass(cssName);
    $target.addClass(cssName);
  },

  add: function (e) {
    var songId = $(e.currentTarget).closest('*[song_id]').attr('song_id');

    var meetingSong = new MeetingModel.MeetingSong({'song_id': songId});
    meetingSong.save(null, {
      wait: true,
      $btn: $(e.currentTarget)
    });
  }

});

var SongView = Backbone.View.extend({

  options: null,

  tagName: 'tr',

  template: "#SongTemplate",

  initialize: function (options) {
    this.options = options || {};
    this.render();
  },

  render: function () {
    var template = _.template($(SongTemplate).find(this.template).html());
    this.$el.empty().html(template(this));
    this.options.$target.append(this.el);
  },

  events: {
    'click *[tag="play"]': 'play'
  },

  play: function (e) {
    if ((this.viewInUse || (this.viewInUse = {})).playerView) {
      this.viewInUse.playerView.close();
    }
    this.viewInUse.playerView = new PlayerView({model: this.model});

    utils.renderNowPlaying($(e.currentTarget), 'success');
  }

});

var PlayerView = Backbone.View.extend({

  template: '#PlayerTemplate',

  initialize: function () {
    this.render();
  },

  render: function () {
    var template = _.template($(SongTemplate).find(this.template).html());
    this.$el.html(template(_.extend({}, {model: this.model}, {userId: $("#IndexContainer").attr("user_id")})));
    $('#PlayerContainer').empty().html(this.el);
  },

  events: {
    'click *[tag="close"]': 'close',
    'click *[tag="add"]': 'add'
  },

  close: function () {
    this.clean();
    this.remove();
  },

  clean: function () {
    var $target = this.$('iframe');
    if ($target.length != 0) {
      $target[0].src = '';
      $target[0].contentWindow.document.write('');
      $target[0].contentWindow.close();
      $target.remove();
    }
    if (typeof CollectGarbage == "function") {
      CollectGarbage();
    }
  },

  add: function (e) {
    SongView.SongsView.prototype.add(e);
  }

});

var EditSongView = Backbone.View.extend({

  uploadedResources: [],
  songResources: [],
  picResources: [],

  template: "#EditSongTemplate",

  initialize: function () {
    this.render();
    if (this.model.id) {
      this.initResources();
    }
    var tThis = this;
    setTimeout(function () {
      if ($("#IndexContainer").attr("user_id")) {
        tThis.$el.tooltip({
          selector: '*[data-toggle="tooltip"]'
        });

        tThis.initUploader('song');
        tThis.initUploader('pic');
      }
    }, 80);
  },

  render: function () {
    var template = _.template($(SongTemplate).find(this.template).html());
    this.$el.html(template(_.extend({}, {model: this.model}, {helper: helper}, {userId: $("#IndexContainer").attr("user_id")})));
    $("#IndexContainer").empty().html(this.el);
  },

  events: {
    'click *[tag="submit"]': 'submit',
    'dblclick *[tag="del"]': 'del',
    'click *[tag="play"]': 'play'
  },

  submit: function (e) {
    var obj = utils.getObjFromForm(this.$el);
    obj.resources = this.uploadedResources;
    var song = this.model;
    var isValid = song.save(obj, {
      wait: true,
      $btn: $(e.currentTarget),
      ajaxSync: true,
      success: function (model, response) {
        if (response&&!response.error) {
          require(['app'], function (Main) {
            Main.router.navigate('#modification/'+song.id);
          });
          var editSongView = new SongView.EditSongView({model: song});
        }
      }
    });
    var $target = this.$('select, input').closest('.form-group').find('*[tag="alert"]').children();
    $target.remove();
    if (!isValid) {
      var i = 0;
      _.each(song.validationError, function (value, key) {
        var $target = this.$('*[name="'+key+'"]').closest('.form-group').find('*[tag="alert"]').first();
        var $alert = $(utils.getAlertHtml('alert-danger', value));
        utils.renderAlert($target, $alert, 1000 * 60);
        if (i == 0) {
         this.$('*[name="'+key+'"]').focus();
        }
        i++;
      }, this);
    }
  },

  del: function (e) {
    this.model.destroy({
      wait: true,
      $btn: $(e.currentTarget),
      success: function (model, response) {
        if (response&&!response.error) {
          require(['app'], function (Main) {
            Main.router.navigate('', {trigger: true, replace: true});
          });
        }
      }
    });
  },

  initUploader: function (type) {

    var tThis = this;
    var $container = '', $btnTarget = '', $startTarget = '';
    var filters = {};
    if (type=='song') {
      $container = tThis.$('*[tag="song"]');
      filters = {
        max_file_size : '10mb',
        mime_types: [
          {title : "Audio files", extensions : "mp3,mid,wma,wav,ogg"}
        ]
      };
    }
    if (type=="pic") {
      $container = tThis.$('*[tag="pic"]');
      filters = {
        max_file_size : '10mb',
        mime_types: [
          {title : "Image files", extensions : "gif,jpg,jpeg,png"}
        ]
      };
    }
    if ($container) {
      $btnTarget = $container.find('*[tag="upload"]');
      $startTarget = $container.find('*[tag="start_upload"]');
    } else {
      return ;
    }

    var uploader = new plupload.Uploader({
      flash_swf_url : '/js/libs/plupload/Moxie.swf',
      runtimes : 'flash',
      container: $container[0],
      browse_button: $btnTarget[0],
      url: 'http://up.qiniu.com:80/',
      filters : filters,
      multipart_params: {
        'token': $("#IndexContainer").attr('token')
      },
      init: {
        PostInit: function () {
          $startTarget.bind('click', function () {
            $(this).attr('disabled', 'disabled');
            uploader.start();
            return false;
          });
        },
        FilesAdded: function (up, files) {
          plupload.each(files, function (file) {
            var template = _.template($(SongTemplate).find('#UploadTemplate').html());
            var $target = $(template({file: file}));
            $container.find('*[tag="upload_container"] tbody').append($target);
            $target.find('*[tag="cancel_upload"]').bind('click', function () {
              uploader.removeFile(file);
              $target.remove();
            });
            file.$target = $target;
          });
          $startTarget.show();
        },
        UploadProgress: function (up, file) {
          var $target = file.$target.find('.progress-bar');
          var progress = file.percent;
          $target.css('width', progress +'%').attr('aria-valuenow', progress).find('span').html(progress +'%');
          file.$target.find('*[tag="cancel_upload"]').attr('disabled', 'disabled');
        },
        Error: function (up, err) {
          var $alert = $(utils.getAlertHtml('alert-danger', err.message));
          var $target = $btnTarget.closest('.row').find('*[tag="alert"]').first();
          utils.renderAlert($target, $alert, 6500);
          if (err.file) {
            var errObj = {
              '614': '文件名已存在'
            };
            var errStr = errObj[err.status]?'（'+errObj[err.status]+'）':'（错误代码'+err.status+'）';
            err.file.$target.find('.progress-bar').find('span').html('上传失败'+errStr);
            err.file.$target.addClass('danger');
            err.file.$target.find('*[tag="cancel_upload"]').removeAttr('disabled');
          }
        },
        BeforeUpload: function (up, file) {
          up.settings.multipart_params['key'] = file.name;
        },
        FileUploaded: function (up, file) {
          file.$target.find('.progress-bar').find('span').html('上传成功');
          file.$target.addClass('success');
          file.$target.find('*[tag="cancel_upload"]').remove();
          var obj = {
            file_name: file.name,
            file_size: file.size,
            uploaded_time: helper.formatDateTime(new Date(), 'second'),
            file_type: type
          };
          if (_.indexOf(_.pluck(tThis.uploadedResources, 'file_name'), obj.file_name) == -1) {
            tThis.uploadedResources.push(obj);
          }
        },
        UploadComplete: function (up, files) {
          $startTarget.removeAttr('disabled');
        }
      }
    });

    uploader.init();

  },

  initResources: function () {

    var songResourcesList = _.filter(this.model.get('resources'), function (obj) {
      return obj.file_type == 'song';
    });
    this.songResources = new ResourceModel.Resources(songResourcesList);
    if (this.songResources.length > 0) {
      var songResourcesView = new ResourceView.ResourcesView({collection: this.songResources, el: this.$('#SongResourcesContainer')});
    }

    var picResourcesList = _.filter(this.model.get('resources'), function (obj) {
      return obj.file_type == 'pic';
    });
    this.picResources = new ResourceModel.Resources(picResourcesList);
    if (this.picResources.length > 0) {
      var picResourcesView = new ResourceView.ResourcesView({collection: this.picResources, el: this.$('#PicResourcesContainer')});
    }

  },

  play: function (e) {
    var resourceId = $(e.currentTarget).closest('*[resource_id]').attr('resource_id');
    this.model.set('song_src', this.songResources.get(resourceId).get('file_name'));

    if ((this.viewInUse || (this.viewInUse = {})).playerView) {
      this.viewInUse.playerView.close();
    }
    this.viewInUse.playerView = new PlayerView({model: this.model});

    utils.renderNowPlaying($(e.currentTarget), 'success');
  }

});

var SongView = {
  ShowSongView: ShowSongView,
  PagerView: PagerView,
  SongView: SongView,
  SongsView: SongsView,
  EditSongView: EditSongView,
  PlayerView: PlayerView
};

return SongView;

});