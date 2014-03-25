define(["jquery","backbone","text!app/templates/song-template.html","helper","utils/utils","plupload/zh_CN","app/models/resource-model","app/views/resource-view","utils/config"],function(e,t,i,n,s,o,r,a){var l=t.View.extend({template:"#ShowSongTemplate",initialize:function(){this.render()},render:function(){var t=_.template(e(i).find(this.template).html());this.$el.html(t(this)),e("#IndexContainer").empty().html(this.el)}}),c=t.View.extend({template:"#SongsTemplate",initialize:function(){this.render()},render:function(){var t=_.template(e(i).find(this.template).html());this.$el.html(t(this)),e("#SongsContainer").empty().html(this.el)},events:{'click *[tag="play"]':"play"},play:function(t){{var i=e(t.currentTarget).closest("*[song_id]").attr("song_id"),n=this.collection.get(i);new d({model:n})}}}),d=t.View.extend({audioInstance:null,template:"#PlayerTemplate",initialize:function(){this.render()},render:function(){var t=_.template(e(i).find(this.template).html());this.$el.html(t(this)),e("#PlayerContainer").empty().html(this.el)},events:{'click *[tag="close"]':"close"},close:function(){this.clean(),this.remove()},clean:function(){var e=this.$("iframe");e[0].src="",e[0].contentWindow.document.write(""),e[0].contentWindow.close(),e.remove(),"function"==typeof CollectGarbage&&CollectGarbage()}}),p=t.View.extend({options:{uploadedResources:[],songResources:[],picResources:[]},template:"#EditSongTemplate",initialize:function(){this.render(),this.$el.tooltip({selector:'*[data-toggle="tooltip"]',placement:"right"}),this.model.id&&this.initResources(),this.initUploader("song"),this.initUploader("pic")},render:function(){var t=_.template(e(i).find(this.template).html());this.$el.html(t(_.extend({},{model:this.model},{helper:n}))),e("#IndexContainer").empty().html(this.el)},events:{'click *[tag="submit"]':"submit",'dblclick *[tag="del"]':"del",'click *[tag="play"]':"play"},submit:function(t){var i=s.getObjFromForm(this.$el);i.resources=this.options.uploadedResources;var n=this.model,o=n.save(i,{wait:!0,$btn:e(t.currentTarget),success:function(e,t){if(t&&!t.error){require(["app"],function(e){e.router.navigate("#modification/"+n.id)});{new u.EditSongView({model:n})}}}}),r=this.$("select, input").closest(".form-group").find('*[tag="alert"]').children();if(r.remove(),!o){var a=0;_.each(n.validationError,function(t,i){var n=this.$('*[name="'+i+'"]').closest(".form-group").find('*[tag="alert"]').first(),o=e(s.getAlertHtml("alert-danger",t));s.renderAlert(n,o,6e4),0==a&&this.$('*[name="'+i+'"]').focus(),a++},this)}},del:function(t){this.model.destroy({wait:!0,$btn:e(t.currentTarget),success:function(e,t){t&&!t.error&&require(["app"],function(e){e.router.navigate("",{trigger:!0,replace:!0})})}})},initUploader:function(t){var r=this,a="",l="",c="",d={};if("song"==t&&(a=r.$('*[tag="song"]'),d={max_file_size:"10mb",mime_types:[{title:"Audio files",extensions:"mp3,mid,wma,wav,ogg"}]}),"pic"==t&&(a=r.$('*[tag="pic"]'),d={max_file_size:"10mb",mime_types:[{title:"Image files",extensions:"gif,jpg,jpeg,png"}]}),a){l=a.find('*[tag="upload"]'),c=a.find('*[tag="start_upload"]');var p=new o.Uploader({flash_swf_url:"/js/libs/plupload/Moxie.swf",runtimes:"flash",container:a[0],browse_button:l[0],url:"http://up.qiniu.com:80/",filters:d,multipart_params:{token:e("#IndexContainer").attr("token")},init:{PostInit:function(){c.bind("click",function(){return e(this).attr("disabled","disabled"),p.start(),!1})},FilesAdded:function(t,n){o.each(n,function(t){var n=_.template(e(i).find("#UploadTemplate").html()),s=e(n({file:t}));a.find('*[tag="upload_container"] tbody').append(s),s.find('*[tag="cancel_upload"]').bind("click",function(){p.removeFile(t),s.remove()}),t.$target=s}),c.show()},UploadProgress:function(e,t){var i=t.$target.find(".progress-bar"),n=t.percent;i.css("width",n+"%").attr("aria-valuenow",n).find("span").html(n+"%"),t.$target.find('*[tag="cancel_upload"]').attr("disabled","disabled")},Error:function(t,i){var n=e(s.getAlertHtml("alert-danger",i.message)),o=l.closest(".row").find('*[tag="alert"]').first();if(s.renderAlert(o,n,6500),i.file){var r={614:"文件名已存在"},a=r[i.status]?"（"+r[i.status]+"）":"（错误代码"+i.status+"）";i.file.$target.find(".progress-bar").find("span").html("上传失败"+a),i.file.$target.addClass("danger"),i.file.$target.find('*[tag="cancel_upload"]').removeAttr("disabled")}},BeforeUpload:function(e,t){e.settings.multipart_params.key=t.name},FileUploaded:function(e,i){i.$target.find(".progress-bar").find("span").html("上传成功"),i.$target.addClass("success"),i.$target.find('*[tag="cancel_upload"]').remove();var s={file_name:i.name,file_size:i.size,uploaded_time:n.formatDateTime(new Date,"second"),file_type:t};-1==_.indexOf(_.pluck(r.options.uploadedResources,"file_name"),s.file_name)&&r.options.uploadedResources.push(s)},UploadComplete:function(){c.removeAttr("disabled")}}});p.init()}},initResources:function(){var e=_.filter(this.model.get("resources"),function(e){return"song"==e.file_type});if(this.options.songResources=new r.Resources(e),this.options.songResources.length>0){new a.ResourcesView({collection:this.options.songResources,el:this.$("#SongResourcesContainer")})}var t=_.filter(this.model.get("resources"),function(e){return"pic"==e.file_type});if(this.options.picResources=new r.Resources(t),this.options.picResources.length>0){new a.ResourcesView({collection:this.options.picResources,el:this.$("#PicResourcesContainer")})}},play:function(t){var i=e(t.currentTarget).closest("*[resource_id]").attr("resource_id");this.model.set("song_src",this.options.songResources.get(i).get("file_name")),(this.viewInUse||(this.viewInUse={}||this.viewInUse)).playerView&&this.viewInUse.playerView.close(),this.viewInUse.playerView=new d({model:this.model})}}),u={ShowSongView:l,SongsView:c,EditSongView:p,PlayerView:d};return u});