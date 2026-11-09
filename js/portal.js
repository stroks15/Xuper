/**
 * Magis / Xuper portal client for browser (Vidaa / any modern TV browser).
 * Protocol reverse-engineered from com.webosflux.xuptertv.fidelity 2.1.2
 */
(function (global) {
  "use strict";

  var HOSTS = ["osuhk.m3x8o50te.com", "oogoy.f30c96w8.com"];
  var SEEDS_URL = "https://raw.githubusercontent.com/xuper-plugin/kino-plugin-xuper/seeds/seeds.json";
  var PROXY_BASE = (global.XUPER_CONFIG && global.XUPER_CONFIG.proxyBase) || "";
  var PORTAL_CODE = "masnew";
  var APP_ID = "com.android.msandroid";
  var APK_VERSION = "49902";
  var APK_VER_HEADER = "43404";
  var SPKG_VER = "2025-08-07 05:40:11_36_16_";
  var USER_AGENT = "okhttp/3.12.12";
  var UA_CDN = "Ranger/4.9.4-17294ac0";
  var FIXED_MAC = "02:00:00:00:00:00";

  var session = { userId: "", userToken: "", sn: "", exp: 0, ready: false };
  var hostIndex = 0;

  function deviceDict() {
    return {
      loginType: "2",
      appLanguage: "en",
      hardwareInfo: "ranchu",
      model: "sdk_gphone64_arm64",
      product: "sdk_gphone64_arm64",
      cpu: "arm64-v8a",
      B29: "",
      reserve1: "",
      deviceToken: "",
      drmId: "",
      sdkVer: 36,
      board: "goldfish_arm64",
      brand: "google",
      cpuAbi: "arm64-v8a",
      device: "emu64a",
      diskInfo: "8GB",
      display: "sdk_gphone64_arm64",
      fingerprint: "google/sdk_gphone64_arm64/emu64a:14/UE1A.230829.036/11228894:user/release-keys",
      hardware: "ranchu",
      host: "abfarm",
      manufacturer: "Google",
      ramSize: "4GB",
      romSize: "8GB",
      tags: "release-keys",
      verId: "",
      appId: APP_ID,
      apkVersion: APK_VERSION,
      mac: FIXED_MAC
    };
  }

  function slbBean() {
    return {
      hasPay: "0",
      userIdentity: "1",
      type: "merge",
      appVer: APK_VERSION,
      lang: "es",
      encMediaSupported: 1,
      liveCodeList: ["masnew_live"],
      appParams: "",
      reserve1: FIXED_MAC,
      pipFlag: "0"
    };
  }

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  function seedExpiry(s) {
    if (s && s.exp && s.exp > 0) return s.exp;
    // seeds.json a veces solo trae mintedAt → asumimos ~12 h de vida
    var m = (s && s.mintedAt) || 0;
    return m > 0 ? m + 12 * 3600 : 0;
  }

  function pickSeed(list) {
    var now = nowSec();
    var valid = list.filter(function (s) {
      return s && s.userId && s.userToken && seedExpiry(s) > now + 120;
    });
    if (!valid.length) {
      // último recurso: cualquier seed con userId/token (el portal dirá si vale)
      valid = list.filter(function (s) { return s && s.userId && s.userToken; });
    }
    if (!valid.length) return null;
    valid.sort(function (a, b) { return seedExpiry(b) - seedExpiry(a); });
    return valid[0];
  }

  function fetchSeeds() {
    return fetch(SEEDS_URL, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("seeds HTTP " + r.status);
        return r.json();
      })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) throw new Error("seeds vacíos");
        var seed = pickSeed(list);
        if (!seed) throw new Error("ningún seed vigente");
        session.userId = String(seed.userId);
        session.userToken = String(seed.userToken);
        session.sn = String(seed.sn || "");
        session.exp = seedExpiry(seed);
        session.ready = true;
        return session;
      });
  }

  function ensureSession() {
    if (session.ready && session.userId && session.userToken) {
      if (!session.exp || session.exp > nowSec() + 60) {
        return Promise.resolve(session);
      }
    }
    return fetchSeeds();
  }

  function post(path, bean) {
    return ensureSession().then(function () {
      var payload = Object.assign(
        {
          portalCode: PORTAL_CODE,
          userId: session.userId,
          userToken: session.userToken
        },
        bean || {},
        deviceDict()
      );
      var encrypted = PortalCrypto.encryptBody(payload);
      var host = HOSTS[hostIndex % HOSTS.length];
      var target = "https://" + host + "/api/portalCore/" + path;
      var url = PROXY_BASE
        ? (PROXY_BASE.replace(/\/$/, "") + "/portal?url=" + encodeURIComponent(target))
        : target;
      var headers = {
        "Content-Type": "application/json;charset=utf-8",
        apk: APP_ID,
        apkVer: APK_VER_HEADER,
        spkgVer: SPKG_VER
      };
      if (!PROXY_BASE) headers["User-Agent"] = USER_AGENT;

      return fetch(url, {
        method: "POST",
        headers: headers,
        body: encrypted
      }).then(function (r) {
        return r.text().then(function (text) {
          var j;
          try {
            j = JSON.parse(text);
          } catch (e) {
            throw new Error(path + ": respuesta no JSON (" + r.status + ")");
          }
          var code = j.returnCode == null ? "" : String(j.returnCode);
          if (code !== "" && code !== "0") {
            var err = new Error(path + " -> " + code + " " + (j.errorMessage || ""));
            err.portalCode = code;
            // rotate host on failure
            hostIndex++;
            throw err;
          }
          if (typeof j.data === "string" && j.data) {
            var dec = PortalCrypto.decryptBlob(j.data);
            return JSON.parse(dec);
          }
          return j.data != null ? j.data : j;
        });
      });
    });
  }

  function collectTracks(episode) {
    var tracks = [];
    var lists = (episode && episode.totalMovieList) || [];
    for (var i = 0; i < lists.length; i++) {
      var ml = (lists[i] && lists[i].movieList) || [];
      for (var j = 0; j < ml.length; j++) {
        if (ml[j] && ml[j].contentId) tracks.push(ml[j]);
      }
    }
    return tracks;
  }

  function vodCdns(slb) {
    var out = [];
    var list = (slb && slb.cdn_list) || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || String(c.tag).toLowerCase() !== "vod") continue;
      var main = String(c.main_addr || "")
        .replace(/^https?:\/\//i, "")
        .replace(/\/+$/, "");
      var urls = c.url_list || [];
      for (var j = 0; j < urls.length; j++) {
        var u = urls[j];
        if (u && String(u.tag).toLowerCase() === "free" && u.url) {
          out.push({
            host: main,
            auth: u.url,
            signType: /sign_type=cfl/i.test(u.url)
              ? "cfl"
              : /sign_type=cs/i.test(u.url)
              ? "cs"
              : /sign_type=goog/i.test(u.url) || /link=google/i.test(u.url)
              ? "google"
              : "other"
          });
        }
      }
    }
    // prefer google / cs that we verified works from this environment
    out.sort(function (a, b) {
      var rank = { google: 0, cs: 1, other: 2, cfl: 3 };
      return (rank[a.signType] || 9) - (rank[b.signType] || 9);
    });
    return out;
  }

  /** Resolve a movie/series episode to a playable stream URL + headers */
  function resolve(contentId, seriesContentId, trackIndex) {
    trackIndex = trackIndex || 0;
    return post("v10/startPlayVOD", {
      contentId: contentId,
      seriesContentId: seriesContentId || "",
      startTime: 0,
      type: "1",
      columnId: 0,
      authType: ""
    }).then(function (play) {
      var ep = (play.episodeList && play.episodeList[0]) || null;
      if (!ep) throw new Error("sin pistas de vídeo");
      var tracks = collectTracks(ep);
      if (!tracks.length) throw new Error("sin pistas de vídeo");
      if (trackIndex < 0 || trackIndex >= tracks.length) trackIndex = 0;
      var track = tracks[trackIndex];
      var license =
        (track.licenseList && track.licenseList[0] && track.licenseList[0].license) || "";
      if (!license) throw new Error("sin licencia de reproducción");
      var fmt = String(track.videoFormat || "ts").toLowerCase() === "mp4" ? "mp4" : "ts";
      var mediaId = track.contentId;

      return post("v14/getSlbInfo", slbBean()).then(function (slb) {
        var cdns = vodCdns(slb);
        if (!cdns.length) throw new Error("sin CDN de VOD");
        // build candidates (prefer working hosts first)
        var candidates = cdns.map(function (c) {
          return {
            url: "https://" + c.host + "/vod/" + mediaId + "_media." + fmt,
            auth: c.auth,
            signType: c.signType,
            host: c.host
          };
        });
        return {
          name: play.name || "",
          mediaId: mediaId,
          contentId: contentId,
          codec: track.encodeFormat || "",
          quality: track.quality || "",
          audio: track.audioInfo || "",
          mime: fmt === "mp4" ? "video/mp4" : "video/mp2t",
          fmt: fmt,
          license: license,
          candidates: candidates,
          // primary suggestion
          url: candidates[0].url,
          headers: {
            "Content-Auth": candidates[0].auth,
            "Content-License": license,
            "User-Agent": UA_CDN,
            App: APP_ID,
            "App-Version": APK_VERSION
          },
          subtitles: (ep.subtitleList || []).map(function (s) {
            var f = (s.file && s.file[0]) || {};
            return { lang: s.language || "", url: f.url || "", format: f.fileType || "srt" };
          }),
          session: { userId: session.userId, exp: session.exp }
        };
      });
    });
  }

  function search(query) {
    return post("v3/searchByName", {
      value: query,
      type: "0",
      columnId: "",
      filter: "",
      pageNum: 1,
      pageSize: 30
    }).then(function (r) {
      // normalize to flat list
      var items = [];
      var a = (r && r.searchItemList) || [];
      for (var s = 0; s < a.length; s++) {
        var u = (a[s] && a[s].itemList) || [];
        for (var l = 0; l < u.length; l++) {
          var c = u[l];
          if (!c) continue;
          items.push({
            contentId: c.contentId || c.id,
            id: c.contentId || c.id,
            name: c.name || c.title,
            title: c.name || c.title,
            type: c.type || "",
            score: c.score,
            posterList: c.posterList,
            poster: c.poster
          });
        }
      }
      if (!items.length && Array.isArray(r && r.list)) items = r.list;
      return { list: items, raw: r };
    });
  }


  // ---- Live TV: tweaked MD5 (sign_o3) ----
  var LIVE_K = [3614090360,3905402710,606105819,3250441966,4118548399,1200080426,2821735955,4249261313,1770035416,2336552879,4294925233,2304563134,1804603682,4254626195,2792965006,1236535329,4129170786,3225465664,643717713,3921069994,3593408605,38016083,3634488961,3889429448,568446438,3275163606,4107603335,1163531501,2850285829,4243563512,1735328473,2368359562,4294588738,2272392833,1839030562,4259657740,2763975236,1272893353,4139469664,3200236656,681279174,3936430074,3564056709,76029189,3654602809,3871185381,530742520,3299628645,4096336452,1126891415,2878612391,4237533241,1700485571,2399980690,4293706877,2240044497,1873313359,4264355552,2734768916,1309151649,4149444226,3174756917,765973179,3951481745];
  var LIVE_S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  var LIVE_ROUND1 = [10,11,12,13,14,15,6,7,8,9,0,1,2,3,4,5];
  var LIVE_G = [];
  for (var iG = 0; iG < 64; iG++) {
    LIVE_G.push(iG < 16 ? LIVE_ROUND1[iG] : iG < 32 ? (5 * iG + 1) % 16 : iG < 48 ? (3 * iG + 5) % 16 : (7 * iG) % 16);
  }
  var LIVE_SALT = new Uint8Array([115,97,108,116,51,51,51,51,61,52,152,13,10,21,50,201,195,130,23,8,192]);

  function rotl(e, t) { return ((e << t) | (e >>> (32 - t))) >>> 0; }
  function liveCompress(state, buf, off) {
    var n = new Array(16), a, i;
    for (a = 0; a < 16; a++) {
      i = off + 4 * a;
      n[a] = (buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16) | (buf[i + 3] << 24)) >>> 0;
    }
    var o = state[0], s = state[1], u = state[2], l = state[3], c, d;
    for (c = 0; c < 64; c++) {
      d = ((c < 16 ? (s & u) | (~s & l) : c < 32 ? (l & s) | (~l & u) : c < 48 ? s ^ u ^ l : u ^ (s | ~l)) + o + LIVE_K[c] + n[LIVE_G[c]]) >>> 0;
      o = l; l = u; u = s; s = (s + rotl(d, LIVE_S[c])) >>> 0;
    }
    state[0] = (state[0] + o) >>> 0;
    state[1] = (state[1] + s) >>> 0;
    state[2] = (state[2] + u) >>> 0;
    state[3] = (state[3] + l) >>> 0;
  }
  function liveDigestHex(bytes) {
    var t = [1732584193, 4023233417, 2562383102, 271733878];
    var r = bytes.length;
    var n = (56 - ((r + 1) % 64) + 64) % 64;
    var a = new Uint8Array(r + 1 + n + 8);
    a.set(bytes, 0);
    a[r] = 128;
    var i = (r % 536870912) * 8;
    var o = Math.floor(r / 536870912);
    var s;
    for (s = 0; s < 4; s++) {
      a[r + 1 + n + s] = (i >>> (8 * s)) & 255;
      a[r + 5 + n + s] = (o >>> (8 * s)) & 255;
    }
    for (var u = 0; u < a.length; u += 64) liveCompress(t, a, u);
    var hex = "";
    for (var c = 0; c < 4; c++) {
      for (var d = 0; d < 4; d++) {
        var f = ((t[c] >>> (8 * d)) & 255).toString(16);
        if (f.length < 2) f = "0" + f;
        hex += f;
      }
    }
    return hex;
  }
  function signO3(token, startMoment) {
    var str = "token=" + token + "&sign2_method=sign_o3&instance=0&start_moment=" + startMoment;
    var enc = new TextEncoder().encode(str);
    var merged = new Uint8Array(enc.length + LIVE_SALT.length);
    merged.set(enc, 0);
    merged.set(LIVE_SALT, enc.length);
    return liveDigestHex(merged);
  }
  function bareHost(e) {
    var t = String(e || "");
    if (t.indexOf("https://") === 0) t = t.slice(8);
    if (t.indexOf("http://") === 0) t = t.slice(7);
    var r = t.indexOf("/");
    return r >= 0 ? t.slice(0, r) : t;
  }
  function liveCdnsOf(slb) {
    var out = [];
    var list = (slb && slb.cdn_list) || [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a || String(a.tag) !== "live") continue;
      var urls = a.url_list || [];
      for (var j = 0; j < urls.length; j++) {
        var s = urls[j];
        var u = (s && s.url) || "";
        if ((s && s.sign_type === "cfl") || u.indexOf("sign_type=cfl") !== -1) {
          var h = bareHost(a.main_addr);
          if (h) out.push({ cflHost: h, authBase: u });
        }
      }
    }
    return out;
  }

  function getLiveCategories() {
    return post("getNextColumns", {
      columnCode: "masnew_live",
      pageNum: 1,
      pageSize: 50,
      version: ""
    }).then(function (r) {
      var n = (r && r.recommendList) || [];
      return n.filter(function (o) { return o && o.columnId; }).map(function (o) {
        return { id: o.columnId, name: o.name || o.title || o.alias || ("Cat " + o.columnId), code: o.code || "" };
      });
    });
  }

  function getLiveChannels(columnId, pageNum, pageSize) {
    pageNum = pageNum || 1;
    pageSize = pageSize || 40;
    return post("v6/getLiveData", {
      columnId: columnId || 76182,
      dataVersion: "",
      pageSize: pageSize,
      pageNum: pageNum,
      expireTimeStr: ""
    }).then(function (t) {
      var a = (t && t.channelList) || [];
      var seen = {};
      var i = [];
      for (var s = 0; s < a.length; s++) {
        var u = a[s];
        if (!u || !u.channelCode || seen[u.channelCode]) continue;
        seen[u.channelCode] = true;
        var l = u.posterUrl || "";
        if (!l && u.posterList && u.posterList[0]) l = u.posterList[0].fileUrl || "";
        i.push({
          channelCode: u.channelCode,
          index: u.channelNumber || i.length + 1,
          name: u.name || u.alias || ("Canal " + (i.length + 1)),
          logo: l,
          uhd: String(u.quality) === "3",
          kind: "live"
        });
      }
      return { channels: i, hasMore: a.length >= pageSize };
    });
  }

  function resolveLive(channelCode) {
    function tryStart(columnId) {
      return post("v4/startPlayLive", {
        channelCode: channelCode,
        columnId: columnId,
        type: "1"
      });
    }
    return tryStart("76182").catch(function () { return tryStart(0); }).then(function (n) {
      var a = (n && n.liveAddressList) || [];
      var i = null;
      for (var o = 0; o < a.length; o++) {
        if (a[o] && a[o].playCode && a[o].license) { i = a[o]; break; }
      }
      if (!i && a[0]) i = a[0];
      if (!i || !i.license) throw new Error("sin licencia de canal");
      var playCode = i.playCode || channelCode;
      var license = i.license;
      var bean = slbBean();
      bean.liveCodeList = [channelCode];
      function trySlb(path) {
        return post(path, bean);
      }
      return trySlb("v15/getSlbInfo").catch(function () { return trySlb("v14/getSlbInfo"); }).then(function (slb) {
        var cdns = liveCdnsOf(slb);
        if (!cdns.length) {
          // fallback: any live tag CDN even without cfl
          var list = (slb && slb.cdn_list) || [];
          for (var x = 0; x < list.length; x++) {
            if (list[x] && list[x].tag === "live") {
              var host = bareHost(list[x].main_addr);
              var url0 = (list[x].url_list && list[x].url_list[0] && list[x].url_list[0].url) || "";
              if (host) cdns.push({ cflHost: host, authBase: url0 });
            }
          }
        }
        if (!cdns.length) throw new Error("sin CDN de vivo");
        var a0 = cdns[0];
        var m3u = "http://" + a0.cflHost + "/live/" + playCode + ".m3u8";
        var tokMatch = (a0.authBase || "").match(/token=([0-9a-fA-F]{32})/);
        var tok = tokMatch ? tokMatch[1] : "";
        var start = Math.trunc(Date.now());
        var sign2 = tok ? signO3(tok, start) : "";
        var auth = a0.authBase || "";
        if (sign2) {
          auth = auth + "&sign2_method=sign_o3&instance=0&start_moment=" + start + "&sign2=" + sign2;
        }
        return {
          name: (n && n.name) || channelCode,
          channelCode: channelCode,
          playCode: playCode,
          url: m3u,
          mime: "application/x-mpegurl",
          kind: "live",
          license: license,
          candidates: [{ url: m3u, auth: auth, host: a0.cflHost, signType: "live" }],
          headers: {
            "Content-Auth": auth,
            "Content-License": license,
            "User-Agent": UA_CDN,
            App: APP_ID,
            "App-Version": APK_VERSION,
            "X-Buffer": "0"
          },
          session: { userId: session.userId, exp: session.exp }
        };
      });
    });
  }



  function detail(contentId) {
    return post("v4/getItemData", {
      contentId: contentId,
      type: "0",
      sortType: "0",
      language: "en",
      macAddr: FIXED_MAC
    }).then(function (n) {
      var i = n && n.assetData;
      if (!i) throw new Error("sin datos del título");
      var episodes = [];
      var u = i.simpleProgramList || [];
      for (var l = 0; l < u.length; l++) {
        var c = u[l];
        if (!c) continue;
        episodes.push({
          id: String(c.contentId || ""),
          title: c.name || ("Ep " + (l + 1)),
          number: c.seriesNumber != null ? c.seriesNumber : l + 1,
          duration: c.duration || "",
          quality: c.quality || ""
        });
      }
      return {
        id: contentId,
        title: i.name || i.title || contentId,
        type: i.type || "",
        episodes: episodes,
        volumeCount: i.volumnCount || i.volumeCount || episodes.length
      };
    });
  }

  /** Resolve movie or series. For series, picks first episode via detail() if needed. */
  function resolveSmart(contentId, seriesContentId, trackIndex) {
    return resolve(contentId, seriesContentId || "", trackIndex).catch(function (err) {
      var msg = String(err && err.message || err);
      // program not found → try as series parent id
      if (msg.indexOf("100008") === -1 && msg.indexOf("no exist") === -1 && msg.indexOf("不存在") === -1) {
        throw err;
      }
      return detail(contentId).then(function (d) {
        if (!d.episodes || !d.episodes.length) throw new Error("serie sin episodios");
        var ep = d.episodes[0];
        return resolve(ep.id, contentId, trackIndex).then(function (stream) {
          stream.name = (d.title || "") + " · " + (ep.title || "");
          stream.seriesId = contentId;
          stream.episodeId = ep.id;
          stream.episodes = d.episodes;
          return stream;
        });
      });
    });
  }


  global.MagisPortal = {
    ensureSession: ensureSession,
    resolve: resolve,
    resolveSmart: resolveSmart,
    detail: detail,
    resolveLive: resolveLive,
    getLiveChannels: getLiveChannels,
    getLiveCategories: getLiveCategories,
    search: search,
    post: post,
    getSession: function () {
      return Object.assign({}, session);
    },
    UA_CDN: UA_CDN,
    APP_ID: APP_ID,
    APK_VERSION: APK_VERSION
  };
})(typeof window !== "undefined" ? window : globalThis);
