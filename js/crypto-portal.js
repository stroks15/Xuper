/**
 * TripleDES-ECB + helpers matching magis.js (XuperTV / Magis portal)
 * Key and wire format are identical to the webOS service we reverse-engineered.
 */
(function (global) {
  "use strict";

  var KEY_HEX = "e7af1ed7de1ffddd7bd3fe37ebdffde9ef3fe1ae39edfeb8";

  // Minimal TripleDES ECB (EDE) using WebCrypto where possible is not available for 3DES,
  // so we ship a compact pure-JS implementation sufficient for 8-byte blocks.

  function fromHex(h) {
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }

  function toHex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += ("0" + bytes[i].toString(16)).slice(-2);
    return s;
  }

  // ---- DES core (single DES) ----
  var PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
  var PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
  var SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
  var IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
  var FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
  var E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
  var P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
  var SBOX = [
    [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
    [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
    [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
    [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
    [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
    [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
    [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
    [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]
  ];

  function bitGet(arr, n) { return (arr[n >> 3] >> (7 - (n & 7))) & 1; }
  function bitSet(arr, n, v) { if (v) arr[n >> 3] |= 1 << (7 - (n & 7)); else arr[n >> 3] &= ~(1 << (7 - (n & 7))); }

  function permute(src, table, nOut) {
    var out = new Uint8Array((nOut + 7) >> 3);
    for (var i = 0; i < table.length; i++) bitSet(out, i, bitGet(src, table[i] - 1));
    return out;
  }

  function desKeySchedule(key8) {
    var k = permute(key8, PC1, 56);
    var c = 0, d = 0, i, j;
    for (i = 0; i < 28; i++) { c = (c << 1) | bitGet(k, i); d = (d << 1) | bitGet(k, i + 28); }
    var subkeys = [];
    for (i = 0; i < 16; i++) {
      c = ((c << SHIFTS[i]) | (c >>> (28 - SHIFTS[i]))) & 0xfffffff;
      d = ((d << SHIFTS[i]) | (d >>> (28 - SHIFTS[i]))) & 0xfffffff;
      var cd = new Uint8Array(7);
      for (j = 0; j < 28; j++) { bitSet(cd, j, (c >> (27 - j)) & 1); bitSet(cd, j + 28, (d >> (27 - j)) & 1); }
      subkeys.push(permute(cd, PC2, 48));
    }
    return subkeys;
  }

  function desF(r32, sk) {
    var er = permute(r32, E, 48);
    var x = new Uint8Array(6);
    for (var i = 0; i < 6; i++) x[i] = er[i] ^ sk[i];
    var sOut = new Uint8Array(4);
    for (var s = 0; s < 8; s++) {
      var b = (x[s >> 1] >> ((s & 1) ? 0 : 4)) & 0x0f;
      // 6-bit chunk
      var six = 0;
      for (var bit = 0; bit < 6; bit++) six = (six << 1) | bitGet(x, s * 6 + bit);
      var row = ((six & 0x20) >> 4) | (six & 1);
      var col = (six >> 1) & 0x0f;
      var val = SBOX[s][row * 16 + col];
      for (var bb = 0; bb < 4; bb++) bitSet(sOut, s * 4 + bb, (val >> (3 - bb)) & 1);
    }
    return permute(sOut, P, 32);
  }

  function desBlock(block8, subkeys, decrypt) {
    var ip = permute(block8, IP, 64);
    var l = new Uint8Array(4), r = new Uint8Array(4);
    for (var i = 0; i < 4; i++) { l[i] = ip[i]; r[i] = ip[i + 4]; }
    for (var round = 0; round < 16; round++) {
      var sk = subkeys[decrypt ? 15 - round : round];
      var f = desF(r, sk);
      var nl = r;
      var nr = new Uint8Array(4);
      for (var j = 0; j < 4; j++) nr[j] = l[j] ^ f[j];
      l = nl; r = nr;
    }
    var pre = new Uint8Array(8);
    for (i = 0; i < 4; i++) { pre[i] = r[i]; pre[i + 4] = l[i]; }
    return permute(pre, FP, 64);
  }

  function desCrypt(data, key8, decrypt) {
    var sk = desKeySchedule(key8);
    var out = new Uint8Array(data.length);
    for (var i = 0; i < data.length; i += 8) {
      var block = data.subarray(i, i + 8);
      out.set(desBlock(block, sk, decrypt), i);
    }
    return out;
  }

  // Triple DES EDE: encrypt with K1, decrypt K2, encrypt K3
  function tripleDesEcb(data, key24, decrypt) {
    var k1 = key24.subarray(0, 8);
    var k2 = key24.subarray(8, 16);
    var k3 = key24.subarray(16, 24);
    if (!decrypt) {
      return desCrypt(desCrypt(desCrypt(data, k1, false), k2, true), k3, false);
    } else {
      return desCrypt(desCrypt(desCrypt(data, k3, true), k2, false), k1, true);
    }
  }

  function pkcs7Pad(data) {
    var pad = 8 - (data.length % 8);
    var out = new Uint8Array(data.length + pad);
    out.set(data);
    for (var i = data.length; i < out.length; i++) out[i] = pad;
    return out;
  }

  function pkcs7Unpad(data) {
    var pad = data[data.length - 1];
    if (pad < 1 || pad > 8) return data;
    return data.subarray(0, data.length - pad);
  }

  function strToBytes(s) {
    var enc = new TextEncoder();
    return enc.encode(s);
  }

  function bytesToStr(b) {
    return new TextDecoder().decode(b);
  }

  function b64encode(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64decode(str) {
    var bin = atob(str);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var KEY = fromHex(KEY_HEX);

  /** Same wire format as magis.js encryptBody */
  function encryptBody(plainObj) {
    var plain = typeof plainObj === "string" ? plainObj : JSON.stringify(plainObj);
    var padded = pkcs7Pad(strToBytes(plain));
    var ct = tripleDesEcb(padded, KEY, false);
    var b64 = b64encode(ct);
    return toHex(strToBytes(b64));
  }

  /** Same wire format as magis.js decryptBlob */
  function decryptBlob(hexStr) {
    var b64bytes = fromHex(hexStr);
    var b64 = bytesToStr(b64bytes);
    var ct = b64decode(b64);
    var pt = tripleDesEcb(ct, KEY, true);
    return bytesToStr(pkcs7Unpad(pt));
  }

  global.PortalCrypto = {
    encryptBody: encryptBody,
    decryptBlob: decryptBlob,
    KEY_HEX: KEY_HEX
  };
})(typeof window !== "undefined" ? window : globalThis);
