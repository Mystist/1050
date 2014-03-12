define(["jquery","backbone","text!app/templates/resource-template.html","app/models/resource-model"],function(e,t,n,r){var i=t.View.extend({initialize:function(){this.render()},render:function(){var e=new r.ResourceStarCollection;e.fetch(),this.$el.empty(),_.each(this.collection.models,function(t){var n=new s.ResourceView({model:t,$target:this.$el,resourceStarCollection:e})},this)}}),s=t.View.extend({options:{resourceStar:null,resourceStarCollection:null},tagName:"tr",template:"#ResourceTemplate",initialize:function(){this.render(),this.renderStars(),this.renderResourceStar()},render:function(){var t=_.template(e(n).find(this.template).html());this.$el.empty().html(t(this)),this.options.$target.append(this.el)},renderStars:function(){this.$('*[tag="stars"]').html(this.model.get("stars"))},renderResourceStar:function(){var t=this.options.resourceStarCollection.where({resource_id:this.model.id});t.length!=0?this.options.resourceStar=t[0]:(this.options.resourceStar=new r.ResourceStar({resource_id:this.model.id}),this.options.resourceStarCollection.add(this.options.resourceStar));var i=_.template(e(n).find("#ResourceStarTemplate").html());this.$('*[tag="resource_star_container"]').empty().html(i({model:this.options.resourceStar}))},events:{'dblclick *[tag="delete_resource"]':"del",'click *[tag="up"]':"up",'click *[tag="down"]':"down"},del:function(t){var n=this;this.model.destroy({wait:!0,$btn:e(t.currentTarget),success:function(e,t){t&&!t.error&&n.remove()}})},save:function(t,n,r){var i=this;this.model.save({plus:n},{wait:!0,patch:!0,$btn:e(t.currentTarget),success:function(e,t){t&&!t.error&&(i.renderStars(),i.options.resourceStar.save({current:r},{wait:!0,success:function(e,t){t&&!t.error&&i.renderResourceStar()}}))}})},up:function(e){var t=0,n=this.options.resourceStar.get("current");n==1?(n=0,t=-1):n==0?(n=1,t=1):n==-1&&(n=1,t=2),this.save(e,t,n)},down:function(e){var t=0,n=this.options.resourceStar.get("current");n==1?(n=-1,t=-2):n==0?(n=-1,t=-1):n==-1&&(n=0,t=1),this.save(e,t,n)}}),s={ResourcesView:i,ResourceView:s};return s});