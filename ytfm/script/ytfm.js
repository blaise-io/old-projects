/**
* ytfm namespace
*/
var ytfm = {};
ytfm = function()
{
	if (ytfm.instance) return ytfm.instance;
	return (ytfm.instance = this);
};

// Y: ytfm shortcut
var Y = new ytfm();

// Console.log for the other browsers
if (typeof console == 'undefined')
{
	var console = {};
	console.log = function(){void(0)};
}

// Empty scrobble queue when leaving
$(window).bind('unload beforeunload', function()
{
	Y.scrobble.flushQueue();
});

// Build DOM
$(document).ready(function()
{
	Y.dom.bootstrap();
});

/**
* YTFM functions
*/
$.extend(ytfm.prototype, {
/**
* =============================================================================
* AJAX - Data retrieval related
* http://jimbojw.com/wiki/index.php?title=SWFHttpRequest_Flash/Ajax_Utility
* =============================================================================
*/
ajax : {

	/**
	* SWFHttpRequest GET wrapper
	*/
	GET : function(url, callback)
	{
		Y.ajax.XDomainRequest(url, 'GET', null, callback);
	},

	/**
	* SWFHttpRequest POST wrapper
	*/
	POST : function(url, body, callback)
	{
		Y.ajax.XDomainRequest(url, 'POST', body, callback);
	},

	/**
	* SWFHttpRequest function
	*/
	XDomainRequest : function(url, method, body, callback)
	{
		callback	= callback || function(json){return;};
		method		= method || 'GET';
		body		= body || '';

		// Queue if not initialized yet
		if (!window.SWFHttpRequest)
		{
			console.log('AJAX queue');
			setTimeout(function()
			{
				Y.ajax.XDomainRequest(url, method, body, callback);
			}, 500);
			return;
		}

		console.log(method, url, body);

		var objSWFHttpRequest = new SWFHttpRequest();
		objSWFHttpRequest.open(method, url);
		objSWFHttpRequest.onreadystatechange = function()
		{
			if (this.readyState != 4) return;
			if (this.status == 200)
			{
				var response = this.responseXML;
				callback(response);
			}
		};
		objSWFHttpRequest.send(body ? body : null);
	}
},


/**
* =============================================================================
* DOM - building initial HTML related
* =============================================================================
*/
dom : {

	/**
	* Build DOM structure
	*/
	bootstrap : function()
	{
		// Load cross-domain ajax SWF
		var $body = $(document.body).empty().attr('class', 'initializing');
		var $xdomainDiv = $('<div>').attr('id', 'xdomain').appendTo($body);
		swfobject.embedSWF('./script/swfhttprequest.swf', 'xdomain', '0', '0', '9.0.0', null, null, {allowScriptAccess: 'always'}, {id: 'swfhttprequest'});

		// Load HTML
		$.get('blank.html', function(html)
		{
			$(document.body).append(html);
			Y.dom.setupEvents();
			Y.playlist.loadByHash();
		});
	},

	setupEvents : function()
	{

		// Current playlist tab
		$('#current-playlist-tab').bind('click', function()
		{
			Y.playlist.showPane(this, '#playlist-list-wrapper');
		});

		// Change playlist tab
		$('#change-playlist-tab').bind('click', function()
		{
			Y.playlist.showPane(this, '#playlist-change-wrapper');
		});

		// Change playlist forms
		var changePlaylistSubmit = function(scope)
		{
			var plform = [];
			var efields = false;
			var $scope = $(scope).parents('form').eq(0);
			$('select, input', $scope).each(function()
			{
				if (!$(this).val()) efields = true;
				else plform[$(this).attr('name')] = $(this).val();
			});
			if (!efields)
			{
				Y.playlist.np = 0;
				Y.lastfm.getPlaylist(plform);
			}
		};

		// Form submit trigger
		$('form', '#playlist-change-wrapper').bind('submit', function(){ return false; });
		$('form', '#playlist-change-wrapper').each(function(index)
		{
			$('button', this).click(function()
			{
				changePlaylistSubmit(this);
			});
			// Enter key = immitate click
			$('input, select', this).keypress(function(e)
			{
				if (e.keyCode == 13) $('button', $(this).parents('form')).click();
			});
		});

		// Change playlist menu
		$('#playlist-change-menu li').each(function(index)
		{
			$(this).bind('click', function()
			{
				$('#playlist-change-menu li').removeClass('active');
				$(this).addClass('active');
				$('.change-playlist-pane', '#playlist-change-wrapper').removeClass('change-playlist-pane-active');
				$('.change-playlist-pane:eq(' + index + ')', '#playlist-change-wrapper').addClass('change-playlist-pane-active');
			});
		});

		// Playlist input suggestions click
		Y.dom.setupRecClicks();

		// Skip button
		$('#control-skiptrack').bind('click', function()
		{
			if (Y.playlist.current.length) Y.player.playNext();
		});

		// Shuffle button
		if (Y.playlist.shuffle)
		{
			$('#control-shuffle').addClass('on');
		}
		$('#control-shuffle').bind('click', function()
		{
			($(this).hasClass('on'))
				? $(this).removeClass('on')
				: $(this).addClass('on');
			Y.playlist.shuffle = ($(this).hasClass('on'));
			Y.playlist.pn = false;
			Y.playlist.pn = Y.playlist.getNextTrack();
		});

		// Scrobble button
		if (Y.scrobble.user.s && Y.scrobble.scrobble)
		{
			$('#control-scrobble').addClass('on');
		}
		$('#control-scrobble').bind('click', function()
		{
			if ($(this).hasClass('on'))
			{
				$(this).removeClass('on');
				Y.scrobble.scrobble = false;
			} else
			{
				if (!Y.scrobble.user.s)
				{
					if (confirm(
						  'Enable scrobbling to submit tracks you play on YTFM to your Last.fm profile.\n\n'
						+ 'For scrobbling, you need a Last.fm account and login on their site.\n\n'
						+ 'Do you want to continue?'))
					{
						window.location.replace('./catch.php?pl=' + location.hash.substring(1));
					}
				} else
				{
					Y.scrobble.scrobble = true;
					$(this).addClass('on');
				}
			}
		});
	},

	updateURLS: function(songURL)
	{
		window.location.href = songURL;

		// Facebook URL
		var title = Y.playlist.name + ' (Playlist on YTFM)';
		var URL = 'http://blaise.io/ytfm/' + songURL;
		$('#facebook').attr('href', 'http://www.facebook.com/sharer.php?t=' + encodeURIComponent(title) + '&u=' + encodeURIComponent(URL)).text('Share current playlist on Facebook');
	},

	setupRecClicks : function()
	{
		$('var', '#playlist-change-wrapper').each(function()
		{
			$(this).unbind('click').click(function()
			{
				var $container = $(this).parents('div:eq(0)');
				$container.find('input:eq(0)').val($(this).text());
				$container.find('button:eq(0)').click();
			});
		});
	}
},

/**
* =============================================================================
* LASTFM - Lastfm data retrieval related
* =============================================================================
*/
lastfm : {

	host : 'https://ws.audioscrobbler.com/2.0/',
	api_key : 'ff9cf4936255f3a68d1a066bcb6fcbe4',

	/**
	* Get a playlist from Last.fm
	*/
	getPlaylist : function(pls)
	{
		// User playlist
		// ['Most played last week', 'Most played', 'Loved tracks', 'Latest library additions']
		var param = [];
		var plsKey = pls.feedtype.toLowerCase().replace(/\s/g, '-');
		switch (pls.feedtype.toUpperCase())
		{
			case 'MOST PLAYED LAST WEEK':
				param['method']	= 'user.getweeklytrackchart';
				param['user']	= pls['user'];
				Y.playlist.name	= 'Weekly chart user: ' + pls['user'];
				Y.playlist.url	= encodeURI('/' + plsKey + '/' + param['user']);
			break;
			case 'MOST PLAYED':
				param['method']	= 'user.gettoptracks';
				param['user']	= pls['user'];
				Y.playlist.name	= 'Top tracks user: ' + pls['user'];
				Y.playlist.url	= encodeURI('/' + plsKey + '/' + param['user']);
			break;
			case 'LOVED TRACKS':
				param['method']	= 'user.getlovedtracks';
				param['user']	= pls['user'];
				Y.playlist.name	= 'Loved by user: ' + pls['user'];
				Y.playlist.url	= encodeURI('/' + plsKey + '/' + param['user']);
			break;
			case 'LATEST LIBRARY ADDITIONS':
				param['method']	= 'library.gettracks';
				param['page']	= '999';
				param['user']	= pls['user'];
				Y.playlist.name	= 'Library: ' + pls['user'];
				Y.playlist.url	= encodeURI('/' + plsKey + '/' + param['user']);
			break;
			case 'TAG':
				param['method']	= 'tag.gettoptracks';
				param['tag']	= pls['tag'];
				Y.playlist.name	= 'Tagged: ' + pls['tag'];
				Y.playlist.url	= encodeURI('/' + plsKey + '/' + param['tag']);
			break;
			case 'ARTIST':
				param['method']	= 'artist.gettoptracks';
				param['artist']	= pls['artist'];
				Y.playlist.name	= 'Artist: ' + pls['artist'];
				Y.playlist.url	= encodeURI('/' + plsKey + '/' + param['artist']);
			break;
			case 'COUNTRY':
				param['method']	= 'geo.gettoptracks';
				param['country']= pls['country'];
				Y.playlist.name	= 'Top 50 country: ' + pls['country'];
				Y.playlist.url	= encodeURI('/' + plsKey + '/' + param['country']);
			break;
			case 'PLAYLIST':
				param['method']	= 'playlist.fetch';
				param['playlist']= pls['playlist'];
				Y.playlist.name	= 'Playlist: ' + pls['playlist'];
				Y.playlist.url	= encodeURI('/' + plsKey + '/' + param['playlist']);
			break;
			default:
				console.log('PLAYLIST invalid: ' + pls['feedtype']);
			break;
		}

		param['api_key']	= Y.lastfm.api_key;
		var playlist_url	= Y.lastfm.host + '?' + Y.tools.http_build_query(param);

		// Cache
		if (typeof Y.playlist.cache[playlist_url] == 'undefined')
		{
			Y.ajax.GET(playlist_url, function(xml)
			{
				Y.playlist.cache[playlist_url] = xml;
				Y.lastfm.parseTracksXML(xml, param['method']);
			});
		} else
		{
			console.log('PLAYLIST from client-side cache');
			Y.lastfm.parseTracksXML(Y.playlist.cache[playlist_url], param['method']);
		}

		// Fill recommendation box with neighbours
		setTimeout(function()
		{
			Y.lastfm.recommend.controller(Y.playlist.url.split('/')[1], Y.playlist.url.split('/')[2]);
		}, 2000);
	},

	/**
	* Parse a Last.fm XML file
	*/
	parseTracksXML : function(xml, method)
	{
		if ($(xml).find('track').length == 0)
		{
			alert('No tracks in this playlist!');
		} else
		{
			var playlist = [];
			$(xml).find('track').each(function(index)
			{
				playlist.push({
					artist	: $(this).find('artist').find('name').text() || $(this).find('artist').text() || $(this).find('creator').text(),
					track	: $(this).find('name:eq(0)').text() || $(this).find('title:eq(0)').text(),
					url		: $(this).find('url:eq(0)').text(),
				});
			});
			Y.playlist.build(playlist);
		}
	},

	/**
	* Recommend new users, artists, tags
	*/
	recommend :
	{
		cacheUser	: [],
		cacheArtist	: [],
		cacheTag	: [],

		/**
		* What type to recommend based on what keyword
		*/
		controller : function(plsKey, plsVal)
		{
			console.log(plsKey, plsVal);
			plsVal = decodeURIComponent(plsVal);
			switch (plsKey)
			{
				case 'most-played-last-week' :
				case 'most-played' :
				case 'loved-tracks' :
				case 'latest-library-additions' :
					Y.lastfm.recommend.user(plsVal);
				break;
				case 'artist' :
					Y.lastfm.recommend.artist(plsVal);
				break;
				case 'tag' :
					Y.lastfm.recommend.tag(plsVal);
				break;
			}
		},

		/**
		* Recommend neighbours and friends
		*/
		user : function(user)
		{
			// Get friends
			param = [];
			param['api_key']	= Y.lastfm.api_key;
			param['user']		= user;
			param['method']		= 'user.getfriends';
			param['limit']		= 22;
			Y.ajax.GET(Y.lastfm.host + '?' + Y.tools.http_build_query(param), function(xml)
			{
				var friends = 'Friends of ' + user + ': ';
				$(xml).find('name').each(function(index)
				{
					friends += '<var>' + $(this).text() + '</var>, ';
				});

				if (friends) friends = friends.substr(0, friends.length - 2) + '.';

				// Get neighbours
				param['method'] = 'user.getneighbours';
				param['limit']	= 5;
				Y.ajax.GET(Y.lastfm.host + '?' + Y.tools.http_build_query(param), function(xml)
				{
					var neighbours = ' Musical neighbours: ';
					$(xml).find('name').each(function(index)
					{
						neighbours += '<var>' + $(this).text() + '</var>, ';
					});

					if (neighbours) neighbours = neighbours.substr(0, neighbours.length - 2) + '.';

					$('#playlist-form-user .recommendations').html(friends + neighbours);
					Y.dom.setupRecClicks();
				});
			});
		},

		/**
		* Recommend similar artists and recommended artist (if user is logged in)
		*/
		artist : function(artist)
		{
			// Get similar
			param = [];
			param['api_key']	= Y.lastfm.api_key;
			param['artist']		= artist;
			param['method']		= 'artist.getsimilar';
			param['limit']		= (Y.scrobble.user.name) ? 10 : 22;
			Y.ajax.GET(Y.lastfm.host + '?' + Y.tools.http_build_query(param), function(xml)
			{
				var similar = 'Similar to ' + artist + ': ';
				$(xml).find('name').each(function(index)
				{
					similar += '<var>' + $(this).text() + '</var>, ';
				});

				if (similar) similar = similar.substr(0, similar.length - 2) + '.';

				// Recommended artists for logged in user
				if (!Y.scrobble.user.name)
				{
					$('#playlist-form-artist .recommendations').html(similar);
					Y.dom.setupRecClicks();
				} else
				{
					Y.ajax.GET('http://ws.audioscrobbler.com/1.0/user/' + Y.scrobble.user.name + '/systemrecs.rss', function(xml)
					{
						var recommends = ' Recommended to you: ';
						var i = 0;
						$(xml).find('item title').each(function(index)
						{
							if (i < 20) recommends += '<var>' + $(this).text() + '</var>, ';
							i++;
						});

						if (recommends) recommends = recommends.substr(0, recommends.length - 2) + '.';
						$('#playlist-form-artist .recommendations').html(similar + recommends);
						Y.dom.setupRecClicks();
					});
				}
			});
		},

		/**
		* Recommend similar tags
		*/
		tag : function(tag)
		{
			param = [];
			param['api_key']	= Y.lastfm.api_key;
			param['tag']		= tag;
			param['method']		= 'tag.getsimilar';
			Y.ajax.GET(Y.lastfm.host + '?' + Y.tools.http_build_query(param), function(xml)
			{
				var tags = 'Tags similar to ' + tag + ': ';
				var i = 0;
				$(xml).find('name').each(function(index)
				{
					if (i < 20) tags += '<var>' + $(this).text() + '</var>, ';
					i++;
				});

				if (tags) tags = tags.substr(0, tags.length - 2) + '.';
				$('#playlist-form-tag .recommendations').html(tags);
				Y.dom.setupRecClicks();
			});
		}
	}
},

/**
* =============================================================================
* PLAYER - YouTube player related
* =============================================================================
*/
player : {

	/**
	* Player vars
	*/
	initialized	: false,
	queue		: [],

	/**
	* Find next video
	* We don't know beforehand which videos are available
	*/
	findNext : function(index, callback)
	{
		index = index || 0;
		if (index >= Y.playlist.current.length) index = Y.playlist.current.length - 1;
		Y.youtube.getFirstAvailable(index, callback);
	},

	/**
	* Init YouTube player
	* http://code.google.com/apis/youtube/player_parameters.html
	*/
	init : function(videoid, index)
	{
		var opts = {
			autoplay		: 1,
			cc_load_policy	: 3, // captions
			color1			: '0xffffff',
			color2			: '0xdddddd',
			egm				: 0,
			enablejsapi		: 1,
			fs				: 1, // enable fullscreen
			hd				: 1, // looks pretty, but is buffering too much
			iv_load_policy	: 3, // annotations
			playerapiid		: 'YouTubeObject',
			rel				: 0, // related vids
			showsearch		: 0,
			showinfo		: 0,
		};

		var params	= {allowScriptAccess: 'always', allowFullScreen: 'true'};
		var atts	= {id: 'YouTubeObject'};
		var req		= videoid + '&' + Y.tools.http_build_query(opts);

		$('<div>').attr('id', 'yt').appendTo('#video-wrapper');
		swfobject.embedSWF('https://www.youtube.com/v/' + req, 'yt', '100%', '100%', '8', null, null, params, atts);

		Y.player.obj = document.getElementById('YouTubeObject');
		Y.player.initialized = true;
		window.setTimeout(function()
		{
			Y.player.startDaemon();
		}, 100);

		$('body').attr('class', 'done');
	},

	/**
	* Play video
	* http://code.google.com/apis/youtube/js_api_reference.html
	*/
	play : function(videoid, index)
	{
		console.log('PLAY ' + videoid);

		if (index != Y.playlist.np) Y.playlist.pn = false;
		if (Y.scrobble.user.s) Y.scrobble.flushQueue();

		Y.playlist.np = index;
		Y.playlist.resetTrack();
		Y.playlist.markNowPlaying(index);
		Y.playlist.scrollToTrack(index);

		var songURL = Y.playlist.track.url = '#' + Y.playlist.url + '/' + (index + 1);

		Y.dom.updateURLS(songURL);

		Y.player.setTitles(index);

		if (!Y.player.initialized)
		{
			Y.player.init(videoid, index);
		} else
		{
			Y.player.obj.clearVideo();
			Y.player.obj.loadVideoById(videoid, 0);
		}
	},

	/**
	* Play next video
	*/
	playNext : function()
	{
		Y.player.findNext(Y.playlist.pn, Y.player.play);
	},

	/**
	* Preload a video
	*/
	preloadVideo : function(param1, param2)
	{
		if (typeof param2 == 'undefined')
		{
			Y.player.findNext(Y.playlist.pn, Y.player.preloadVideo);
		}
		// else
		// {
			// console.log('Preloading ' + param1);
			// Y.playlist.pnl = true;
			// Y.player.obj.cueVideoById(param1, 0);
		// }
	},

	/**
	* Set document + h1 title
	*/
	setTitles : function(np)
	{
		document.title = $('#playlist-list li').eq(np).text() + ' (YTFM)';
		$('#title-trackno').text((np+1) + '.');
		$('#title-artist').text(Y.playlist.current[np].artist);
		$('#title-track').text(Y.playlist.current[np].track);
	},

	/**
	* Start daemon
	* Checks scrobbling, video end, playlist change
	*/
	startDaemon : function()
	{
		console.log('Daemon started');
		window.setInterval(function()
		{

			if (typeof Y.player.obj.getPlayerState == 'undefined') return;

			var Ytr = Y.playlist.track;
			Ytr.state		= Y.player.obj.getPlayerState();
			Ytr.position	= Y.player.obj.getCurrentTime();
			Ytr.duration	= Y.player.obj.getDuration();
			Ytr.lfmvalid	= Y.scrobble.checkValid(Y.playlist.np);

			// Track change
			if (typeof Y.playlist.track.url != 'undefined' && encodeURI(window.location.hash) != Y.playlist.track.url)
			{
				Y.playlist.compareHash(window.location.hash, Y.playlist.track.url);
				Y.playlist.track.url = encodeURI(window.location.hash); // Prevent hammering
			}

			// unstarted (-1), ended (0), playing (1), paused (2), buffering (3), video cued (5)
			if (Y.playlist.track.state == 1)
			{
				Y.playlist.track.lfmpos = Y.playlist.track.lfmpos + .5; // Called every 500 ms
			}

			// Last.fm now playing
			if (Y.playlist.track.lfmpos > 5 && Y.playlist.track.lfmvalid && !Y.playlist.track.lfmplayed)
			{
				Y.scrobble.nowPlaying(Y.playlist.np);
			}

			// Last.fm scrobbling
			if (Y.playlist.track.lfmvalid && !Y.playlist.track.lfmqueued
				&& (Y.playlist.track.lfmpos > 240 || Y.playlist.track.lfmpos > Y.playlist.track.duration / 2))
			{
				Y.scrobble.addQueue(Y.playlist.np);
			}

			// Video ending, play next, queue next on 3/4
			var remaining = Y.playlist.track.duration - Y.playlist.track.position;
			if (Y.playlist.track.state == 1 && remaining < Y.playlist.track.duration / 4)
			{
				if (!Y.playlist.pnl) Y.player.preloadVideo(Y.playlist.pn);
				if (remaining < 3) Y.player.playNext();
			}
		}, 500);
	}
},

/**
* =============================================================================
* PLAYLIST - playlist and current track related
* =============================================================================
*/
playlist : {

	cache	: [],		// Cached playlists
	current : [],		// Current playlist
	np		: 0,		// Now playing track index
	pn		: false,	// Playing next track index
	pnl		: false,	// Playing next loaded
	track	: {},		// Current track live state
	shuffle	: false,	// Random next track

	/**
	* Load a playlist based on hash
	*/
	loadByHash : function()
	{
		var hash = decodeURIComponent(document.location.hash);
		hash = hash.split('/');
		hash.shift();

		// User playlist: Last.fm user
		$('#playlist-form-user input:eq(0)').val(Y.scrobble.user.name);

		// Country playlist: Client country
		Y.ajax.GET('https://api.hostip.info/', function(xml)
		{
			var country = $(xml).find('countryName:eq(0)').text().toLowerCase();
			$('#playlist-form-country option[value=' + country + ']').attr('selected', true);
		});

		if (hash[0])
		{
			Y.playlist.np	= (typeof hash[2] == 'undefined') ? 0 : parseInt(hash[2]) - 1;
			var pls			= [];
			switch (hash[0])
			{
				case 'most-played-last-week' :
				case 'most-played' :
				case 'loved-tracks' :
				case 'latest-library-additions' :
					pls['user'] = hash[1];
					$('#playlist-change-menu li:eq(1)').click();
					$('#playlist-form-user input:eq(0)').val(hash[1]);
				break;
				case 'artist' :
					pls[hash[0]] = hash[1];
					$('#playlist-change-menu li:eq(0)').click();
					$('#playlist-form-artist input:eq(0)').val(hash[1]);
				break;
				case 'tag' :
					pls[hash[0]] = hash[1];
					$('#playlist-change-menu li:eq(2)').click();
					$('#playlist-form-tag input:eq(0)').val(hash[1]);
				break;
				case 'country' :
					pls[hash[0]] = hash[1];
					$('#playlist-change-menu li:eq(3)').click();
					$('#playlist-form-country option[value='+hash[1]+']').attr({selected : true});
				break;
				case 'playlist' :
					pls[hash[0]] = hash[1];
					$('#playlist-change-menu li:eq(4)').click();
					$('#playlist-form-playlist input:eq(0)').val(hash[1]);
				break;
			}

			var userPlaylistIndex = false;
			switch (hash[0])
			{
				case 'most-played-last-week'	: userPlaylistIndex = 0; break;
				case 'most-played'				: userPlaylistIndex = 1; break;
				case 'loved-tracks'				: userPlaylistIndex = 2; break;
				case 'latest-library-additions'	: userPlaylistIndex = 3; break;
			}
			if (userPlaylistIndex !== false)
			{
				$('#playlist-form-user option:eq(' + userPlaylistIndex + ')').attr({selected : true});
			}

			pls['feedtype'] = hash[0].replace(/-/g, ' ');
			Y.lastfm.getPlaylist(pls);
		}
	},

	/**
	* Compare hash to detect if user changed playlist or track
	*/
	compareHash : function(newh, oldh)
	{
		var newhs = newh.split('/');
		var oldhs = oldh.split('/');
		if (newhs[1] == oldhs[1] && newhs[2] == oldhs[2])
		{
			Y.player.findNext(parseInt(newhs[3]) - 1, Y.player.play);
		} else
		{
			Y.playlist.loadByHash();
		}
	},

	/**
	* Build playlist dom and arrays
	*/
	build : function(playlist)
	{
		var $playlist = $('#playlist-list').empty();
		$(playlist).each(function(index)
		{
			$('<li class="unknown">'
				+ '<span class="track-no" id="track-' + (index + 1) + '">' + (index + 1) + '. </span>'
				+ '<span class="artist-track">' + this.artist + ' <span class="sep">–</span> ' + this.track + '</span>')
				.appendTo($playlist)
				.bind('click.track', function()
				{
					Y.playlist.scrollToTrack(index);
					Y.playlist.markNowPlaying(index);
					if (Y.playlist.np == index)
					{
						console.log('Rewind');
						Y.player.obj.seekTo(0, 0);
					}
					else if (typeof Y.playlist.current[index].available != 'undefined')
					{
						if (Y.playlist.current[index].videoid)
						{
							Y.player.play(Y.playlist.current[index].videoid, index);
						}
					} else
					{
						Y.player.findNext(index, Y.player.play);
					}
				});
		});

		// Reset values
		Y.playlist.current	= playlist;
		Y.playlist.pn		= false,
		Y.playlist.pnl		= false
		Y.playlist.track	= [];

		// Show playlist pane
		Y.playlist.showPane('#current-playlist-tab', '#playlist-list-wrapper');

		// Show playlist text
		$('#current-playlist-tab span').text(Y.playlist.name + ' (' + Y.playlist.current.length + ')');

		// Find next video (autoplay)
		Y.player.findNext(Y.playlist.np, Y.player.play);
	},

	/**
	* Mark a playlist item as available or unavailable
	*/
	markAvailable : function(index, available, videoid)
	{
		// Mark in playlist
		Y.playlist.current[index].available	= available;
		Y.playlist.current[index].videoid	= videoid || false;

		var $li = $('li', '#playlist-list').eq(index);

		// Mark in visual playlist
		if (available)
		{
			$li.removeClass('unknown').addClass('available');
		} else if (!$li.hasClass('unavailable'))
		{
			$li.removeClass('unknown')
				.addClass('unavailable')
				.unbind('click.track')
				.find('.artist-track').append(' <span class="status">(unavailable)</span>');
		}
	},

	/**
	* Mark currently playing track
	*/
	markNowPlaying : function(index)
	{
		$('li', '#playlist-list').removeClass('nowplaying');
		$('li', '#playlist-list').eq(index).addClass('nowplaying');
	},

	/**
	* Show a playlist pane (and hide all other panes)
	*/
	showPane : function(button, pane)
	{
		// button.blur();
		$('li', '#tabs-wrapper').removeClass('active');
		$(button).addClass('active');
		$('.playlist-pane', '#playlist-wrapper').removeClass('playlist-pane-active');
		$(pane).addClass('playlist-pane-active');
	},

	/**
	* Reset current track live states
	*/
	resetTrack : function()
	{
		Y.playlist.pn	= Y.playlist.getNextTrack();
		Y.playlist.pnl	= false;
		Y.playlist.track = {
			start		: Y.scrobble.user.timediff + parseInt(new Date().getTime()),
			state		: -1,
			position	: 0,
			duration	: 0,
			lfmpos		: 0,
			lfmvalid	: false,
			lfmplayed	: false,
			lfmqueued	: false,
			lfmscrobbled: false
		};
	},

	/**
	* Get next track
	*/
	getNextTrack : function()
	{
		// Return playing next
		if (Y.playlist.pn !== false) return Y.playlist.pn;

		// Not set yet, calculate next track
		var np = parseInt(Y.playlist.np);
		var pn = np + 1;
		if (pn >= Y.playlist.current.length) pn = 0;
		if (Y.playlist.shuffle) pn = Math.floor(Math.random() * Y.playlist.current.length);
		return pn;
	},

	/**
	* Scroll to current track
	*/
	scrollToTrack : function(np)
	{
		var pHeight		= $('#playlist-list-wrapper').height();
		var pScroll		= $('#playlist-list-wrapper').scrollTop();
		var npOffset	= $('#playlist-list-wrapper li').eq(np).position().top;
		var y			= npOffset + pScroll - (pHeight / 2) + 39;
		$('#playlist-list-wrapper').animate({scrollTop : y});
	}
},


/**
* =============================================================================
* SCROBBLE - Last.fm scrobble / track submitting related
* http://www.last.fm/api/submissions
* =============================================================================
*/
scrobble : {

	queue		: [],	// Queue tracks, flush on song change
	scrobble	: true,	// Enable scrobbling (also needs valid session)
	user		: {
		// name		: <?php echo '\'' . addslashes($_SESSION['user']) . '\''; ?>,	// Last.fm username
		// s			: <?php echo '\'' . $_SESSION['s'] . '\''; ?>,		// Session key
		// np			: <?php echo '\'' . $_SESSION['np_url'] . '\''; ?>,	// Now playing submit url
		// sm			: <?php echo '\'' . $_SESSION['sm_url'] . '\''; ?>,	// Scrobble submit url
		// timediff	: <?php echo time(); ?> - Math.round(new Date().getTime() / 1000) // Correct client computer's time
	},

	/**
	* Scrobbling valid?
	*/
	checkValid : function()
	{
		return (Y.scrobble.scrobble && Y.scrobble.user.s && Y.playlist.track.duration > 40);
	},

	/**
	* Send now playing
	*/
	nowPlaying : function(np)
	{
		var param = {
			s : Y.scrobble.user.s,
			a : Y.playlist.current[np].artist,
			t : Y.playlist.current[np].track,
			b : '',
			l : Math.round(Y.playlist.track.duration),
			n : '',
			m : ''
		};
		param = Y.tools.http_build_query(param);
		Y.ajax.POST(Y.scrobble.user.np, param, function(lfm)
		{
			if ($.trim(lfm) == 'BADSESSION')
			{
				Y.ajax.GET('catch.php?refreshsession=true', function(s)
				{
					console.log(s);
					sp = s.split("\n");
					if (sp[0] == 'OK')
					{
						Y.scrobble.user.s	= sp[1];
						Y.scrobble.user.np	= sp[2];
						Y.scrobble.user.sm	= sp[3];
					}
					else
					{
						Y.scrobble.requireNewSession();
					}
				});
			}
			console.log('NOWPLAYING: ' + lfm);
		});
		Y.playlist.track.lfmplayed = true;
	},

	requireNewSession : function()
	{
		$('#control-scrobble').click();
	},

	/**
	* Queue track
	*/
	addQueue : function(np)
	{
		console.log('SCROBBLE added to queue:' + $('#playlist-list li').eq(np).text());
		Y.scrobble.queue.push({
			a : Y.playlist.current[np].artist,
			t : Y.playlist.current[np].track,
			i : Math.round(Y.playlist.track.start / 1000),
			o : 'P',
			r : '',
			l : Math.round(Y.playlist.track.duration),
			b : '',
			n : '',
			m : ''
		});
		Y.playlist.track.lfmqueued = true;
	},

	/**
	* Flush queue
	*/
	flushQueue : function()
	{
		if (Y.scrobble.queue.length > 0)
		{
			var param = [];
			for (var i in Y.scrobble.queue)
			{
				for (var j in Y.scrobble.queue[i])
				{
					param[j] = [];
					param[j][i] = Y.scrobble.queue[i][j];
				}
			}
			param['s'] = Y.scrobble.user.s;
			param = Y.tools.http_build_query(param);
			Y.ajax.POST(Y.scrobble.user.sm, param, function(lfm)
			{
				console.log('SCROBBLE: ' + lfm);
				if ($.trim(lfm) == 'OK') Y.scrobble.queue = [];
			});
		}
	}
},


/**
* =============================================================================
* TOOLS - Data manipulation related
* =============================================================================
*/
tools : {

	/**
	* Build query string
	* Based on http://phpjs.org/functions/http_build_query:428
	*/
	http_build_query : function(formdata, numeric_prefix, arg_sep)
	{
		arg_sep = arg_sep || '&';
		var value, key, tmp = [];
		var build_q_rec = function(key, val, arg_sep)
		{
			var k, tmp = [];
			if (val === true)		val = '1';
			else if (val === false)	val = '0';
			else if (typeof(val) == 'array' || typeof(val) == 'object')
			{
				for (k in val)
				{
					if(val[k] !== null)
					{
						tmp.push(build_q_rec(key + '[' + k + ']', val[k], arg_sep));
					}
				}
				return tmp.join(arg_sep);
			} else if(typeof(val) != 'function')
			{
				return encodeURIComponent(key) + '=' + encodeURIComponent(val);
			}
		};
		for (key in formdata)
		{
			value = formdata[key];
			if (numeric_prefix && !isNaN(key))
			{
				key = String(numeric_prefix) + key;
			}
			tmp.push(build_q_rec(key, value, arg_sep));
		}
		return tmp.join(arg_sep);
	}
},


/**
* =============================================================================
* YOUTUBE - YouTube data related
* =============================================================================
*/
youtube : {

	/**
	* YT API host
	*/
	host : 'https://gdata.youtube.com/feeds/api/videos',

	/**
	* YT API default settings
	* http://code.google.com/apis/youtube/2.0/developers_guide_protocol_api_query_parameters.html
	*/
	param : {
		'alt'			: 'atom', // json is preferred, but the feeds sometimes contains syntax errors
		'category'		: 'Music',
		'format'		: '5', // embeddable vids
		'key'			: 'AI39si6NkFK4mXXlJAaCyvAlT8EHN85U1bwleFQLNXqTaQVaBoodYXMBh2UU5RnmLZUyt_lG42DYOdg6664XbwceAR7OAkhZJg',
		'max-results'	: '3',
		// 'restriction'	: '<?php echo $_SERVER['REMOTE_ADDR']; ?>',
		'safeSearch'	: 'none',
		'v'				: '2'
	},

	/**
	* Get YT video id by playlist index
	*/
	getVideoXML : function(index, callback)
	{
		var artist		= Y.playlist.current[index].artist;
		var track		= Y.playlist.current[index].track.replace(/ ?\((.*)\)$/, ''); // removes (feat ...) / (live) / (album version), etc
		var param		= Y.youtube.param;
		param['q']		= '"' + artist + '", "' + track + '"';
		var video_url	= Y.youtube.host + '?' + Y.tools.http_build_query(param);
		Y.ajax.GET(video_url, callback);
	},

	/**
	* Get the first available track
	*/
	getFirstAvailable : function(index, callback, tries)
	{
		if (Y.playlist.current.length == index) return;
		if (typeof Y.playlist.current[index].videoid != 'undefined')
		{
			if (Y.playlist.current[index].videoid)
			{
				callback(Y.playlist.current[index].videoid, index);
			}
			else
			{
				index++;
				tries++;
				Y.youtube.getFirstAvailable(index, callback, tries);
			}
			return;
		}

		// Don't kill the YT servers
		tries = tries || 1;
		if (tries > 10)
		{
			console.log('Too many unavailable tracks in this playlist');
			return;
		}

		Y.youtube.getVideoXML(index, function(xml)
		{
			var videoid = Y.youtube.parseVideoXML(xml, index);
			if (!videoid)
			{
				console.log('Cannot find a video for ' + (index+1) + ': ' + Y.playlist.current[index].artist + ' - ' + Y.playlist.current[index].track);
				index++;
				tries++;
				setTimeout(function(){ Y.youtube.getFirstAvailable(index, callback, tries); }, 200);
			} else
			{
				callback(videoid, index);
			}
		});
	},

	/**
	* Parse video XML
	* This returns the best matching YT video ID
	*/
	parseVideoXML : function(xml, index)
	{
		// Don't show emo kids playing guitar
		var rating = {
			'(c)'			: 1,
			'buy'			: 1,
			'direct'		: 1,
			'music video'	: 2,
			'official'		: 2,
			'quality'  		: 1,
			'single'  		: 1,
			'order'			: 1,
			'in stores'  	: 1,

			'concert'		: -1,
			'cover'			: -1,
			'festival'		: -1,
			'karaoke'		: -2,
			'live'			: -1,
			'me playing'	: -2,
			'me singing'	: -2,
			'mix'			: -2,
			'learn'			: -1,
			'perform'		: -1
		};

		if ($(xml).find('entry').length == 0)
		{
			Y.playlist.markAvailable(index, false);
			return false;
		} else
		{
			var win = {vid : '', pts : 0};
			$(xml).find('entry').each(function(index)
			{
				var p = 50;
				var desc = $(this).find('media\\:description, description').eq(0).text().toLowerCase()
					+ $(this).find('media\\:title, title').eq(0).text().toLowerCase();
				for (var key in rating)
				{
					if (desc.match(key))
					{
						p += parseInt(rating[key]);
					}
				}
				if (p > win.pts)
				{
					win.pts = p;
					win.vid = $(this).find('yt\\:videoid, videoid').eq(0).text();
				}
			});
			Y.playlist.markAvailable(index, true, win.vid);
			return win.vid;
		}
	}
}

});
