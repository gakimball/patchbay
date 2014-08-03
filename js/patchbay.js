;(function() {

/*====================
  Base Player class
  ====================*/
var Player = function(elem) {
  this.$container = $(elem),
  this.ui = {};
}
Player.prototype = {
  /*
    Searches the player for all elements with the data attribute "patchbay-ui", and adds them to the player's UI object, using the value of the data attribute as the key.
  */
  findUI: function() {
    var _this = this;
    this.$container.find('[data-patchbay-ui]').each(function() {
      var name = $(this).attr('data-patchbay-ui');
      if (name.length === 0) return;
      _this.ui[name] = $(this);
    });
  },
  /*
    These events are used by both master and inline players.
  */
  coreEvents: function() {
    var _this = this;

    // Looks for play/pause buttons and adds event handlers so they trigger a matching event when clicked
    $.each(['playpause', 'play', 'pause'], function(index, trigger) {
      if (_this.ui[trigger]) {
        _this.ui[trigger].click(function() {
          _this.$container.trigger('patchbay-'+trigger, [_this]);
        });
      }
    });
    // If the player has playpause text, swap the "play" and "pause" text when the player state changes
    // The text to swap to is stored in the data attribute "alt" on the text element
    if (this.ui.playpause) {
      $(window).on({
        'patchbay-playing': function() {
          if (_this.active) {
            _this.ui.playpause.text(Patchbay.settings.pauseText);
          }
        },
        'patchbay-paused': function() {
          if (_this.active) {
            _this.ui.playpause.text(Patchbay.settings.playText);
          }
        }
      });
    }
    // If the player has time text, update the text as the player audio progresses
    if (this.ui.currenttime || this.ui.duration) {
      $(window).on('patchbay-time', function(event, time, duration) {
        _this.updateTimeText(time, duration);
      });
    }
  },
  /*
    Update text on the player showing current time and total time of the playing track.
  */
  updateTimeText: function(time, duration) {
    this.ui.currenttime.text(Patchbay.util.secToStamp(time));
    this.ui.duration.text(Patchbay.util.secToStamp(duration));
  }
}

/*====================
  Master Player class
  ====================*/
var MasterPlayer = function($elem) {
  this.$container   = $elem;
  this.$audioPlayer = $();
  this.ui           = {};
  this.initialized  = false;
  this.active       = false;

  // Find or add audio element
  var $maybeAudio = $elem.find('audio');
  if ($maybeAudio.length > 0) {
    this.$audioPlayer = $maybeAudio.eq(0);
  }
  else {
    this.$audioPlayer = $('<audio />').appendTo($elem);
  }

  this.findUI();
  this.coreEvents();
  this.events();
  this.listen();
}
MasterPlayer.prototype = $.extend({
  initialize: function() {
    this.$container.addClass('is-active');
    this.initialized = true;
    this.active = true;
  },

  // Events to be listened for
  listen: function() {
    var _this = this;

    $(window).on({
      'patchbay-playpause': function(event, source) {
        if (source instanceof MasterPlayer) {
          if (_this.initialized) _this.playPause();
        }
        else if (source instanceof InlinePlayer) {
          if (!source.active) {
            _this.loadTrack(source);
          }
          else {
            _this.playPause();
          }
        }
      },
      'patchbay-play': function(event, source) {

      },
      'patchbay-pause': function(event, source) {

      }
    });
  },

  // Events to be broadcasted
  events: function() {
    var _this = this;

    // Internal events
    this.$audioPlayer.on({
      'play': function() {
        $(this).trigger('patchbay-playing');
        console.log("Play triggered.");
      },
      'pause': function() {
        $(this).trigger('patchbay-paused');
        console.log("Pause triggered.");
      },
      'timeupdate': function() {
        $(this).trigger('patchbay-time', [this.currentTime, this.duration]);
      },
      'ended': function() {
        _this.next();
      }
    });
  },

  // Basic playback functions
  play: function() {
    this.$audioPlayer[0].play();
    this.$container.addClass('is-playing');
  },
  pause: function() {
    this.$audioPlayer[0].pause();
    this.$container.removeClass('is-playing');
  },
  playPause: function() {
    if (this.$audioPlayer[0].paused) {
      this.play();
    }
    else {
      this.pause();
    }
  },

  // Track loader
  loadTrack: function(source) {
    var _this = this
      , trackInfo = source.getTrackInfo();

    // Pause existing audio before destroying it
    this.pause();

    // Inserting source elements
    this.$audioPlayer.empty();
    $.each(trackInfo.source.value, function(index, file) {
      var srcElem = $('<source></source>');
      srcElem
        .attr('src', file)
        .appendTo(_this.$audioPlayer);
    });

    // And play
    $(window).trigger('patchbay-deactivate');
    $(source).trigger('patchbay-activate');
    this.initialize();
    this.play();
  }

}, Player.prototype);


/*====================
  Inline Player class
  ====================*/
var InlinePlayer = function($elem) {
  this.$container   = $elem;
  this.$audioPlayer = $();
  this.trackInfo    = {};
  this.currentTime  = 0;
  this.ui           = {};
  this.initialized  = false;
  this.active       = false;
  this.playing      = false;

  this.findUI();
  this.coreEvents();
  this.events();
  this.listen();
}
InlinePlayer.prototype = $.extend({
  events: function() {
    
  },
  listen: function() {
    var _this = this;

    // The master player triggers directly on the inline player to tell it that it can receive events
    $(this).on({
      'patchbay-activate': function() {
        if (!this.active) {
          this.activate();
        }
      }
    });
    // The player only responds to master player updates if it's active
    $(window).on({
      'patchbay-deactivate': function(event) {
        if (_this.active) {
          _this.deactivate();
        }
      },
      'patchbay-playing': function(event) {
        if (_this.active) {
          _this.play();
        }
      },
      'patchbay-paused': function(event) {
        if (_this.active) {
          _this.pause();
        }
      },
    });
  },

  // Find the source of the track in the player's data attributes.
  // url = internal URL, uses Patchbay.settings.server
  // ext = external URL, must be absolute
  // id  = track ID, for an API call, uses Patchbay.settings.endpoint
  getTrackInfo: function() {
    // If track info has been cached, just send it back
    if (!$.isEmptyObject(this.trackInfo)) return this.trackInfo;

    var _this = this
      , info = {};

    // Track metadata
    $.each(['title', 'artist', 'album', 'cover'], function(index, key) {
      if (key === 'cover') info[key] = (_this.ui[key] || $()).attr('src');
      else info[key] = (_this.ui[key] || $()).text();
    });

    // Track URLs/endpoints
    var trackData = this.$container.data('patchbay-track').split(':');
    // - Internal or external URL
    if (trackData[0] === 'url' || trackData[0] === 'ext') {
      var fileList = trackData[1].split(',');
      if (trackData[0] === 'url') {
        $.each(fileList, function(index, file) {
          fileList[index] = Patchbay.settings.server + file;
        });
      }
      info['source'] = {
        type:  trackData[0],
        value: fileList
      };
    }
    // - API call
    else if (trackData[0] === 'id') {
      info['source'] = {
        type:  trackData[0],
        value: trackData[1]
      }
    }

    // Cache it for later
    this.trackInfo = info;

    return info;
  },

  // This function may not necessary
  init: function() {
    this.$container.addClass('is-initialized');
    this.initialized = true;
  },

  // Update the state of the player to show if it's the active track
  activate: function() {
    if (!this.initialized) {
      this.init();
    }
    this.$container.addClass('is-active');
    this.active = true;
    this.play();
  },
  deactivate: function() {
    this.$container.removeClass('is-active');
    this.active = false;
    this.pause();
  },

  // Update the state of the player to show it's playing or paused
  play: function() {
    this.$container.addClass('is-playing');
    this.playing = true;
  },
  pause: function() {
    this.$container.removeClass('is-playing');
    this.playing = false;
  }
}, Player.prototype);

/*====================
  Plugin object
  ====================*/
Patchbay = {
  masterPlayer:  $(),
  inlinePlayers: [],
  settings: {
    server: window.location.origin,
    scope: document,
    autosweep: true,
    playText: 'Play',
    pauseText: 'Pause'
  },
  /*
    Initialize the Patchbay plugin, importing developer settings.
    By default the plugin will scan for audio players, unless the developer specifies otherwise.
  */
  init: function(settings) {
    this.settings = $.extend(this.settings, settings);
    if (this.settings.autosweep) {
      this.sweep();
    }

    console.log(this);
  },
  /*
    Search the page for audio players, which use the data attributes "patchbay-master" and "patchbay-player".
    On subsequent sweeps, players already initialized will be skipped.
  */
  sweep: function() {
    var _this = this;

    // Find the master player if necessary
    if (this.masterPlayer.length === 0) {
      var $master = $('[data-patchbay-master]');
      // Warn if there aren't any master players
      if ($master.length === 0) {
        console.log("YO: No master player was found. You can't play any audio without one!");
      }
      else {
        // Initialize the master player, but only the first one in case the developer added more than one
        this.masterPlayer = new MasterPlayer($master.eq(0));

        // Warn if there's more than one master player
        if ($master.length > 1) {
          console.log("YO: More than one master player was found, so only the first one was initialized.");
        }
      }
    }

    // Sweep the page for uninitialized inline players
    $(this.settings.scope).find('[data-patchbay-track]').not('.is-initialized').each(function() {
      _this.inlinePlayers.push(new InlinePlayer($(this)));
    });

    // TODO: Sweep the page for uninitialized collections
  },
  /*
    Utility functions
  */
  util: {
    /*
      Convert an integer (number of seconds) to a timestamp with the format m:ss.
    */
    secToStamp: function(seconds) {
      var min = parseInt(seconds / 60)
      var sec = (seconds % 60 < 10) ? ('0'+parseInt(seconds % 60)) : parseInt(seconds % 60);
      return min+':'+sec;
    },
    /*
      Convert a timestamp with the format mm:ss to an integar equalling the number of seconds.
    */
    stampToSec: function(stamp) {
      var stamp = stamp.split(':');
      return (stamp[0] * 60) + parseInt(stamp[1]);
    }
  }
}

$(function() {
  Patchbay.init();
});

})();