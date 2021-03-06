﻿define(['jquery', 'backbone', 'text!app/templates/resource-template.html', 'app/models/resource-model', 'helper', 'utils/config'],

function($, Backbone, ResourceTemplate, ResourceModel, helper, config) {

var ResourcesView = Backbone.View.extend({

  initialize: function() {
    this.render();
  },
  
  render: function() {
  
    var resourceStarCollection = new ResourceModel.ResourceStarCollection();
    resourceStarCollection.fetch();
    
    this.$el.empty().hide();
    _.each(this.collection.models, function(model) {
      var resourceView = new ResourceView.ResourceView({model: model, $target: this.$el, resourceStarCollection: resourceStarCollection});
    }, this);
    this.$el.show();
    
  }

});

var ResourceView = Backbone.View.extend({

  options: null,
  resourceStar: null,

  tagName: 'tr',

  template: "#ResourceTemplate",
  
  initialize: function(options) {
    this.options = options || {};
    this.render();
    this.renderStars();
    this.renderResourceStar();
  },
  
  render: function() {
    var template = _.template($(ResourceTemplate).find(this.template).html());
    this.$el.empty().html(template(_.extend({}, this, {helper: helper}, {config: config}, {userId: $("#IndexContainer").attr("user_id")})));
    this.options.$target.append(this.el);
  },
  
  renderStars: function() {
    this.$('*[tag="stars"]').html(this.model.get('stars'));
  },
  
  renderResourceStar: function() {

    var resourceStar = this.options.resourceStarCollection.where({'resource_id': this.model.id});
    if(resourceStar.length!=0) {
      this.resourceStar = resourceStar[0];
    } else {
      this.resourceStar = new ResourceModel.ResourceStar({'resource_id': this.model.id});
      this.options.resourceStarCollection.add(this.resourceStar);
    }
    
    var template = _.template($(ResourceTemplate).find('#ResourceStarTemplate').html());
    this.$('*[tag="resource_star_container"]').empty().html(template({model: this.resourceStar}));
    
  },
  
  events: {
    'dblclick *[tag="delete_resource"]': 'del',
    'click *[tag="up"]': 'up',
    'click *[tag="down"]': 'down'
  },
  
  del: function(e) {
    var tThis = this;
    this.model.destroy({
      wait: true,
      $btn: $(e.currentTarget),
      success: function(model, response) {
        if(response&&!response.error) {
          tThis.remove();
        }
      }
    });
  },
  
  save: function(e, plus, current) {
    var tThis = this;
    this.model.save({'plus': plus}, {
      wait: true,
      patch: true,
      $btn: $(e.currentTarget),
      success: function(model, response) {
        if(response&&!response.error) {
          tThis.renderStars();
          tThis.resourceStar.save({'current': current}, {
            wait: true,
            success: function(model, response) {
              if(response&&!response.error) {
                tThis.renderResourceStar();
              }
            }
          });
        }
      }
    });
  },
  
  up: function(e) {
    var plus = 0;
    var current = this.resourceStar.get('current');
    if(current==1) {
      current = 0;
      plus = -1;
    } else if(current==0) {
      current = 1;
      plus = 1;
    } else if(current==-1) {
      current = 1;
      plus = 2;
    }
    this.save(e, plus, current);
  },
  
  down: function(e) {
    var plus = 0;
    var current = this.resourceStar.get('current');
    if(current==1) {
      current = -1;
      plus = -2;
    } else if(current==0) {
      current = -1;
      plus = -1;
    } else if(current==-1) {
      current = 0;
      plus = 1;
    }
    this.save(e, plus, current);
  }

});

var ResourceView = {
  ResourcesView: ResourcesView,
  ResourceView: ResourceView
};

return ResourceView;

});