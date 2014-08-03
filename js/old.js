;(function($) {

  /*
    Master player object
  */

  var Player = function($obj) {

    this.$player = $obj;
    this.$audio  = $obj.find('[data-audio]').eq(0);
    this.initialized = false;

    this.ui = {
      bPlayPause:   $obj.find('[data-playpause]'),
      bPrevTrack:   $obj.find('[data-prevtrack]'),
      bNextTrack:   $obj.find('[data-nexttrack]'),
      bMenuButton:  $obj.find('[data-menu]'),
      uSlider:      $obj.find('[data-slider]'),
      uPlaylist:    $obj.find('[data-playlist]'),
      uProgress:    $obj.find('[data-progress]'),
      iTrackTitle:  $obj.find('[data-title]').eq(0),
      iArtistName:  $obj.find('[data-artist]').eq(0),
      iCurrentTime: $obj.find('[data-currenttime]').eq(0),
      iTotalTime:   $obj.find('[data-totaltime]').eq(0),
      iCoverArt:    $obj.find('[data-coverart]'),
    };

    this.playlist = [];
    this.playlistIndex = 0;

    this.server = window.location.origin;
    this.api    = '/api/tracks/';

    this.events();
  }

  Player.prototype = {
    initialize: function() {
      this.initialized = true;
      this.$player.removeClass('inactive is-playlist-open');
    },

    events: function() {
      var self = this;

      // Internal triggers
      this.$audio.on({
        'ended': function() {
          self.nextTrack();
        },
        'timeupdate': function() {
          self.updateTimeUI();
        },
        'play': function() {
          self.ui.bPlayPause.html('&#xE601;').removeClass('loading');
        },
        'pause': function() {
          self.ui.bPlayPause.html('&#xE600;');
        }
      });
      this.$player.on({
        'player-playlistloaded': function() {
          self.updatePlaylistUI();
          self.changeTrack(self.playlistIndex);
        },
        'player-playpause': function() {
          if (self.$audio[0].paused === true) {
            self.$audio[0].play();
          }
          else {
            self.$audio[0].pause();
          }
        },
        'player-nexttrack': function() {
          self.nextTrack();
        },
        'player-prevtrack': function() {
          self.prevTrack();
        },
      });

      // UI triggers
      this.ui.bPlayPause.click(function(){
        self.$player.trigger('player-playpause');
      });
      this.ui.bPrevTrack.click(function(){
        self.$player.trigger('player-prevtrack')
      });
      this.ui.bNextTrack.click(function(){
        self.$player.trigger('player-nexttrack')
      });
      this.ui.bMenuButton.click(function(){
        self.$player.toggleClass('is-playlist-open');
      });

      this.ui.uPlaylist.on('click', 'li', function(){
        self.changeTrack($(this).index());
      })
    },

    loadPlaylist: function(tracklist) {
      var self = this;

      if (tracklist instanceof Array) {
        $.getJSON(this.server + this.api + tracklist.join(','), function(data) {
          self.playlist = data;
          self.$player.trigger('player-playlistloaded');
        });
      }
    },
    loadTrack: function(index) {
      this.playlistIndex = index;

      this.ui.bPlayPause.html('&#128340;').addClass('loading');

      var wasPlaying = !this.$audio[0].paused || !this.initialized;
      this.$audio.empty();

      // MP3 file
      var mp3_source = document.createElement('source');
      mp3_source.setAttribute('type', 'audio/mpeg; codecs="mp3"');
      mp3_source.setAttribute('src', this.playlist[index]['audio_mp3']);
      this.$audio.append(mp3_source);

      // Ogg file
      var ogg_source = document.createElement('source');
      ogg_source.setAttribute('type', 'audio/ogg; codes="vorbis"');
      ogg_source.setAttribute('src', this.playlist[index]['audio_ogg']);
      this.$audio.append(ogg_source);

      this.$audio[0].load();
      // if (wasPlaying === true) this.$audio[0].play(); 
      this.$audio[0].play();
      this.updatePlayerUI();
      this.updateTimeUI();

      if (this.initialized === false) this.initialize();
    },

    updatePlayerUI: function() {
      var track = this.playlist[this.playlistIndex];
      this.ui.iTrackTitle.text(track['title']);
      this.ui.iArtistName.text(track['artist']);
      this.ui.iTotalTime.text(track['length']);
      this.ui.iCoverArt.attr('src', track['cover']);
    },
    updateTimeUI: function() {
      var cur = this.$audio[0].currentTime;
      var sec = (cur % 60 < 10) ? ('0'+parseInt(cur % 60)) : parseInt(cur % 60);
      this.ui.iCurrentTime.text(parseInt(cur / 60)+':'+sec);

      // Seeker
      var pct = this.$audio[0].currentTime / this.$audio[0].duration * 100;
      this.ui.uProgress.children('span').css('width', pct+'%');
    },
    updateButtonUI: function() {

    },
    updatePlaylistUI: function() {
      var self = this;
      var tracklist = this.ui.uPlaylist;
      tracklist.empty();

      $.each(this.playlist, function(i){
        var li   = document.createElement('li');
        var a    = document.createElement('a');
        var span = document.createElement('span');

        a.innerHTML    = self.playlist[i]['title'];
        a.setAttribute('class', 'no-ajaxy');
        span.innerHTML = self.playlist[i]['length'];

        a.appendChild(span);
        li.appendChild(a);
        tracklist.append(li);
      });
    },

    prevTrack: function() {
      if (this.playlistIndex !== 0) {
        this.playlistIndex--;
        this.changeTrack(this.playlistIndex);
      }
    },
    nextTrack: function() {
      if (this.playlist.length !== this.playlistIndex + 1) {
        this.playlistIndex++;
        this.changeTrack(this.playlistIndex);
      }
    },
    changeTrack: function(index) {
      this.loadTrack(index);

      // Active states for next/prev buttons
      if (index === 0) {
        this.ui.bPrevTrack.addClass('inactive');
        this.ui.bNextTrack.removeClass('inactive')
      }
      if (index === this.playlist.length - 1) {
        this.ui.bNextTrack.addClass('inactive')
        this.ui.bPrevTrack.removeClass('inactive');
      }
      if (index === 0 && index === this.playlist.length - 1) {
        this.ui.bPrevTrack.add(this.ui.bNextTrack).addClass('inactive');
      }

      // Active states for playlist
      this.ui.uPlaylist.children().removeClass('active').eq(this.playlistIndex).addClass('active');
    }
  }

  /*
    Document ready
  */

  $(function(){
    var masterPlayer = new Player($('[data-player]'));

    // Clicking a track
    $('body').on('click', '[data-player-track]', function(e){
      e.preventDefault();

      var clicked_track = $(this).attr('data-player-track');
      var $parent = $(this).closest('[data-player-collection]');
      var $collection = $(this).closest('[data-player-collection]').find('[data-player-track]');

      // No collection found, this is a standalone track
      if ($parent.length === 0) {
        masterPlayer.loadPlaylist([$(this).attr('data-player-track')]);
        return;
      }

      // This is the active playlist, don't hit the database
      if (typeof $parent.attr('data-active-collection') !== 'undefined') {
        var new_index = $collection.index(this);
        masterPlayer.changeTrack(new_index);
      }
      // Not the active playlist, hit the database for track metadata
      else {
        var track_ids = [];
        $collection.each(function(index){
          var track_id = $(this).attr('data-player-track');
          track_ids.push(track_id);
          if (track_id == clicked_track) {
            masterPlayer.playlistIndex = index;
          }
        });
        masterPlayer.loadPlaylist(track_ids);
        $parent.attr('data-active-collection', '');
      }

    });

    // Clicking a player
    $('body').on('click', '[data-load-release]', function(e){
      e.preventDefault();

      this_id = $(this).attr('data-load-release');
      $('#content')
        .find('[data-player-collection="'+this_id+'"]')
          .find('[data-player-track]').eq(0).click();
    });

  });

})(window.Zepto || window.jQuery);