var Qi=Object.defineProperty,Xi=Object.defineProperties;var Gi=Object.getOwnPropertyDescriptors;var sn=Object.getOwnPropertySymbols;var Zi=Object.prototype.hasOwnProperty,es=Object.prototype.propertyIsEnumerable;var on=(Q,H,F)=>H in Q?Qi(Q,H,{enumerable:!0,configurable:!0,writable:!0,value:F}):Q[H]=F,ce=(Q,H)=>{for(var F in H||(H={}))Zi.call(H,F)&&on(Q,F,H[F]);if(sn)for(var F of sn(H))es.call(H,F)&&on(Q,F,H[F]);return Q},xe=(Q,H)=>Xi(Q,Gi(H));(function(){"use strict";async function Q(n){try{const e=await fetch(`${n.apiBase}/livechat/config?siteKey=${encodeURIComponent(n.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function H(n,e,t){const i=new FormData;i.append("siteKey",n.siteKey),i.append("visitorId",n.visitorId),i.append("sessionId",e),i.append("file",t,t.name);const s=await fetch(`${n.apiBase}/livechat/upload`,{method:"POST",body:i,credentials:"omit"});if(!s.ok){const o=await s.text().catch(()=>"");throw new Error(`${s.status} ${s.statusText}${o?` — ${o}`:""}`)}return s.json()}async function F(n,e){const t=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const i=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${i?` — ${i}`:""}`)}return t.json()}function ut(n,e){return F(`${n.apiBase}/livechat/track/pageview`,ce({siteKey:n.siteKey,visitorId:n.visitorId},e))}function ft(n,e){return F(`${n.apiBase}/livechat/track/heartbeat`,{siteKey:n.siteKey,visitorId:n.visitorId,url:e.url,title:e.title}).catch(()=>{})}function Ve(n,e){const t=`${n.apiBase}/livechat/track/leave`,i=JSON.stringify({siteKey:n.siteKey,visitorId:n.visitorId,pageviewId:e});if(navigator.sendBeacon){const s=new Blob([i],{type:"application/json"});navigator.sendBeacon(t,s);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:i,keepalive:!0}).catch(()=>{})}function mt(n,e,t,i,s,o,r){return F(`${n.apiBase}/livechat/message`,{siteKey:n.siteKey,visitorId:n.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:i,pageContext:s,replyToId:o||void 0,replyToContent:r||void 0})}function Ke(n,e){return F(`${n.apiBase}/livechat/identify`,{siteKey:n.siteKey,visitorId:n.visitorId,email:e.email,name:e.name})}const rn=Object.freeze(Object.defineProperty({__proto__:null,fetchSiteConfig:Q,identify:Ke,sendMessage:mt,trackHeartbeat:ft,trackLeave:Ve,trackPageview:ut,uploadAttachment:H},Symbol.toStringTag,{value:"Module"})),ie=Object.create(null);ie.open="0",ie.close="1",ie.ping="2",ie.pong="3",ie.message="4",ie.upgrade="5",ie.noop="6";const Oe=Object.create(null);Object.keys(ie).forEach(n=>{Oe[ie[n]]=n});const Ye={type:"error",data:"parser error"},gt=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",yt=typeof ArrayBuffer=="function",bt=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n&&n.buffer instanceof ArrayBuffer,We=({type:n,data:e},t,i)=>gt&&e instanceof Blob?t?i(e):xt(e,i):yt&&(e instanceof ArrayBuffer||bt(e))?t?i(e):xt(new Blob([e]),i):i(ie[n]+(e||"")),xt=(n,e)=>{const t=new FileReader;return t.onload=function(){const i=t.result.split(",")[1];e("b"+(i||""))},t.readAsDataURL(n)};function vt(n){return n instanceof Uint8Array?n:n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength)}let Je;function an(n,e){if(gt&&n.data instanceof Blob)return n.data.arrayBuffer().then(vt).then(e);if(yt&&(n.data instanceof ArrayBuffer||bt(n.data)))return e(vt(n.data));We(n,!1,t=>{Je||(Je=new TextEncoder),e(Je.encode(t))})}const wt="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",ve=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let n=0;n<wt.length;n++)ve[wt.charCodeAt(n)]=n;const cn=n=>{let e=n.length*.75,t=n.length,i,s=0,o,r,c,l;n[n.length-1]==="="&&(e--,n[n.length-2]==="="&&e--);const y=new ArrayBuffer(e),x=new Uint8Array(y);for(i=0;i<t;i+=4)o=ve[n.charCodeAt(i)],r=ve[n.charCodeAt(i+1)],c=ve[n.charCodeAt(i+2)],l=ve[n.charCodeAt(i+3)],x[s++]=o<<2|r>>4,x[s++]=(r&15)<<4|c>>2,x[s++]=(c&3)<<6|l&63;return y},ln=typeof ArrayBuffer=="function",Qe=(n,e)=>{if(typeof n!="string")return{type:"message",data:kt(n,e)};const t=n.charAt(0);return t==="b"?{type:"message",data:dn(n.substring(1),e)}:Oe[t]?n.length>1?{type:Oe[t],data:n.substring(1)}:{type:Oe[t]}:Ye},dn=(n,e)=>{if(ln){const t=cn(n);return kt(t,e)}else return{base64:!0,data:n}},kt=(n,e)=>{switch(e){case"blob":return n instanceof Blob?n:new Blob([n]);case"arraybuffer":default:return n instanceof ArrayBuffer?n:n.buffer}},_t="",pn=(n,e)=>{const t=n.length,i=new Array(t);let s=0;n.forEach((o,r)=>{We(o,!1,c=>{i[r]=c,++s===t&&e(i.join(_t))})})},hn=(n,e)=>{const t=n.split(_t),i=[];for(let s=0;s<t.length;s++){const o=Qe(t[s],e);if(i.push(o),o.type==="error")break}return i};function un(){return new TransformStream({transform(n,e){an(n,t=>{const i=t.length;let s;if(i<126)s=new Uint8Array(1),new DataView(s.buffer).setUint8(0,i);else if(i<65536){s=new Uint8Array(3);const o=new DataView(s.buffer);o.setUint8(0,126),o.setUint16(1,i)}else{s=new Uint8Array(9);const o=new DataView(s.buffer);o.setUint8(0,127),o.setBigUint64(1,BigInt(i))}n.data&&typeof n.data!="string"&&(s[0]|=128),e.enqueue(s),e.enqueue(t)})}})}let Xe;function Le(n){return n.reduce((e,t)=>e+t.length,0)}function $e(n,e){if(n[0].length===e)return n.shift();const t=new Uint8Array(e);let i=0;for(let s=0;s<e;s++)t[s]=n[0][i++],i===n[0].length&&(n.shift(),i=0);return n.length&&i<n[0].length&&(n[0]=n[0].slice(i)),t}function fn(n,e){Xe||(Xe=new TextDecoder);const t=[];let i=0,s=-1,o=!1;return new TransformStream({transform(r,c){for(t.push(r);;){if(i===0){if(Le(t)<1)break;const l=$e(t,1);o=(l[0]&128)===128,s=l[0]&127,s<126?i=3:s===126?i=1:i=2}else if(i===1){if(Le(t)<2)break;const l=$e(t,2);s=new DataView(l.buffer,l.byteOffset,l.length).getUint16(0),i=3}else if(i===2){if(Le(t)<8)break;const l=$e(t,8),y=new DataView(l.buffer,l.byteOffset,l.length),x=y.getUint32(0);if(x>Math.pow(2,21)-1){c.enqueue(Ye);break}s=x*Math.pow(2,32)+y.getUint32(4),i=3}else{if(Le(t)<s)break;const l=$e(t,s);c.enqueue(Qe(o?l:Xe.decode(l),e)),i=0}if(s===0||s>n){c.enqueue(Ye);break}}}})}const St=4;function P(n){if(n)return mn(n)}function mn(n){for(var e in P.prototype)n[e]=P.prototype[e];return n}P.prototype.on=P.prototype.addEventListener=function(n,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+n]=this._callbacks["$"+n]||[]).push(e),this},P.prototype.once=function(n,e){function t(){this.off(n,t),e.apply(this,arguments)}return t.fn=e,this.on(n,t),this},P.prototype.off=P.prototype.removeListener=P.prototype.removeAllListeners=P.prototype.removeEventListener=function(n,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+n];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+n],this;for(var i,s=0;s<t.length;s++)if(i=t[s],i===e||i.fn===e){t.splice(s,1);break}return t.length===0&&delete this._callbacks["$"+n],this},P.prototype.emit=function(n){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+n],i=1;i<arguments.length;i++)e[i-1]=arguments[i];if(t){t=t.slice(0);for(var i=0,s=t.length;i<s;++i)t[i].apply(this,e)}return this},P.prototype.emitReserved=P.prototype.emit,P.prototype.listeners=function(n){return this._callbacks=this._callbacks||{},this._callbacks["$"+n]||[]},P.prototype.hasListeners=function(n){return!!this.listeners(n).length};const Re=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),X=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),gn="arraybuffer";function ts(){}function Et(n,...e){return e.reduce((t,i)=>(n.hasOwnProperty(i)&&(t[i]=n[i]),t),{})}const yn=X.setTimeout,bn=X.clearTimeout;function Be(n,e){e.useNativeTimers?(n.setTimeoutFn=yn.bind(X),n.clearTimeoutFn=bn.bind(X)):(n.setTimeoutFn=X.setTimeout.bind(X),n.clearTimeoutFn=X.clearTimeout.bind(X))}const xn=1.33;function vn(n){return typeof n=="string"?wn(n):Math.ceil((n.byteLength||n.size)*xn)}function wn(n){let e=0,t=0;for(let i=0,s=n.length;i<s;i++)e=n.charCodeAt(i),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(i++,t+=4);return t}function Tt(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function kn(n){let e="";for(let t in n)n.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(n[t]));return e}function _n(n){let e={},t=n.split("&");for(let i=0,s=t.length;i<s;i++){let o=t[i].split("=");e[decodeURIComponent(o[0])]=decodeURIComponent(o[1])}return e}class Sn extends Error{constructor(e,t,i){super(e),this.description=t,this.context=i,this.type="TransportError"}}class Ge extends P{constructor(e){super(),this.writable=!1,Be(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,i){return super.emitReserved("error",new Sn(e,t,i)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=Qe(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=kn(e);return t.length?"?"+t:""}}class En extends Ge{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let i=0;this._polling&&(i++,this.once("pollComplete",function(){--i||t()})),this.writable||(i++,this.once("drain",function(){--i||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=i=>{if(this.readyState==="opening"&&i.type==="open"&&this.onOpen(),i.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(i)};hn(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,pn(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=Tt()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let It=!1;try{It=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(n){}const Tn=It;function In(){}class An extends En{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let i=location.port;i||(i=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||i!==e.port}}doWrite(e,t){const i=this.request({method:"POST",data:e});i.on("success",t),i.on("error",(s,o)=>{this.onError("xhr post error",s,o)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,i)=>{this.onError("xhr poll error",t,i)}),this.pollXhr=e}}class se extends P{constructor(e,t,i){super(),this.createRequest=e,Be(this,i),this._opts=i,this._method=i.method||"GET",this._uri=t,this._data=i.data!==void 0?i.data:null,this._create()}_create(){var e;const t=Et(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const i=this._xhr=this.createRequest(t);try{i.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){i.setDisableHeaderCheck&&i.setDisableHeaderCheck(!0);for(let s in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(s)&&i.setRequestHeader(s,this._opts.extraHeaders[s])}}catch(s){}if(this._method==="POST")try{i.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(s){}try{i.setRequestHeader("Accept","*/*")}catch(s){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(i),"withCredentials"in i&&(i.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(i.timeout=this._opts.requestTimeout),i.onreadystatechange=()=>{var s;i.readyState===3&&((s=this._opts.cookieJar)===null||s===void 0||s.parseCookies(i.getResponseHeader("set-cookie"))),i.readyState===4&&(i.status===200||i.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof i.status=="number"?i.status:0)},0))},i.send(this._data)}catch(s){this.setTimeoutFn(()=>{this._onError(s)},0);return}typeof document!="undefined"&&(this._index=se.requestsCount++,se.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=In,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete se.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(se.requestsCount=0,se.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",At);else if(typeof addEventListener=="function"){const n="onpagehide"in X?"pagehide":"unload";addEventListener(n,At,!1)}}function At(){for(let n in se.requests)se.requests.hasOwnProperty(n)&&se.requests[n].abort()}const Cn=(function(){const n=Ct({xdomain:!1});return n&&n.responseType!==null})();class On extends An{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=Cn&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new se(Ct,this.uri(),e)}}function Ct(n){const e=n.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||Tn))return new XMLHttpRequest}catch(t){}if(!e)try{return new X[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const Ot=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class Ln extends Ge{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,i=Ot?{}:Et(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(i.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,i)}catch(s){return this.emitReserved("error",s)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;We(i,this.supportsBinary,o=>{try{this.doWrite(i,o)}catch(r){}s&&Re(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=Tt()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const Ze=X.WebSocket||X.MozWebSocket;class $n extends Ln{createSocket(e,t,i){return Ot?new Ze(e,t,i):t?new Ze(e,t):new Ze(e)}doWrite(e,t){this.ws.send(t)}}class Rn extends Ge{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=fn(Number.MAX_SAFE_INTEGER,this.socket.binaryType),i=e.readable.pipeThrough(t).getReader(),s=un();s.readable.pipeTo(e.writable),this._writer=s.writable.getWriter();const o=()=>{i.read().then(({done:c,value:l})=>{c||(this.onPacket(l),o())}).catch(c=>{})};o();const r={type:"open"};this.query.sid&&(r.data=`{"sid":"${this.query.sid}"}`),this._writer.write(r).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;this._writer.write(i).then(()=>{s&&Re(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const Bn={websocket:$n,webtransport:Rn,polling:On},qn=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,Nn=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function et(n){if(n.length>8e3)throw"URI too long";const e=n,t=n.indexOf("["),i=n.indexOf("]");t!=-1&&i!=-1&&(n=n.substring(0,t)+n.substring(t,i).replace(/:/g,";")+n.substring(i,n.length));let s=qn.exec(n||""),o={},r=14;for(;r--;)o[Nn[r]]=s[r]||"";return t!=-1&&i!=-1&&(o.source=e,o.host=o.host.substring(1,o.host.length-1).replace(/;/g,":"),o.authority=o.authority.replace("[","").replace("]","").replace(/;/g,":"),o.ipv6uri=!0),o.pathNames=Pn(o,o.path),o.queryKey=Mn(o,o.query),o}function Pn(n,e){const t=/\/{2,9}/g,i=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&i.splice(0,1),e.slice(-1)=="/"&&i.splice(i.length-1,1),i}function Mn(n,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(i,s,o){s&&(t[s]=o)}),t}const tt=typeof addEventListener=="function"&&typeof removeEventListener=="function",qe=[];tt&&addEventListener("offline",()=>{qe.forEach(n=>n())},!1);class le extends P{constructor(e,t){if(super(),this.binaryType=gn,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const i=et(e);t.hostname=i.host,t.secure=i.protocol==="https"||i.protocol==="wss",t.port=i.port,i.query&&(t.query=i.query)}else t.host&&(t.hostname=et(t.host).host);Be(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(i=>{const s=i.prototype.name;this.transports.push(s),this._transportsByName[s]=i}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=_n(this.opts.query)),tt&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},qe.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=St,t.transport=e,this.id&&(t.sid=this.id);const i=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](i)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&le.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",le.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let i=0;i<this.writeBuffer.length;i++){const s=this.writeBuffer[i].data;if(s&&(t+=vn(s)),i>0&&t>this._maxPayload)return this.writeBuffer.slice(0,i);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,Re(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,i){return this._sendPacket("message",e,t,i),this}send(e,t,i){return this._sendPacket("message",e,t,i),this}_sendPacket(e,t,i,s){if(typeof t=="function"&&(s=t,t=void 0),typeof i=="function"&&(s=i,i=null),this.readyState==="closing"||this.readyState==="closed")return;i=i||{},i.compress=i.compress!==!1;const o={type:e,data:t,options:i};this.emitReserved("packetCreate",o),this.writeBuffer.push(o),s&&this.once("flush",s),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},i=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?i():e()}):this.upgrading?i():e()),this}_onError(e){if(le.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),tt&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const i=qe.indexOf(this._offlineEventListener);i!==-1&&qe.splice(i,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}le.protocol=St;class Dn extends le{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),i=!1;le.priorWebsocketSuccess=!1;const s=()=>{i||(t.send([{type:"ping",data:"probe"}]),t.once("packet",A=>{if(!i)if(A.type==="pong"&&A.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;le.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{i||this.readyState!=="closed"&&(x(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const k=new Error("probe error");k.transport=t.name,this.emitReserved("upgradeError",k)}}))};function o(){i||(i=!0,x(),t.close(),t=null)}const r=A=>{const k=new Error("probe error: "+A);k.transport=t.name,o(),this.emitReserved("upgradeError",k)};function c(){r("transport closed")}function l(){r("socket closed")}function y(A){t&&A.name!==t.name&&o()}const x=()=>{t.removeListener("open",s),t.removeListener("error",r),t.removeListener("close",c),this.off("close",l),this.off("upgrading",y)};t.once("open",s),t.once("error",r),t.once("close",c),this.once("close",l),this.once("upgrading",y),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{i||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let i=0;i<e.length;i++)~this.transports.indexOf(e[i])&&t.push(e[i]);return t}}let jn=class extends Dn{constructor(e,t={}){const i=typeof e=="object"?e:t;(!i.transports||i.transports&&typeof i.transports[0]=="string")&&(i.transports=(i.transports||["polling","websocket","webtransport"]).map(s=>Bn[s]).filter(s=>!!s)),super(e,i)}};function zn(n,e="",t){let i=n;t=t||typeof location!="undefined"&&location,n==null&&(n=t.protocol+"//"+t.host),typeof n=="string"&&(n.charAt(0)==="/"&&(n.charAt(1)==="/"?n=t.protocol+n:n=t.host+n),/^(https?|wss?):\/\//.test(n)||(typeof t!="undefined"?n=t.protocol+"//"+n:n="https://"+n),i=et(n)),i.port||(/^(http|ws)$/.test(i.protocol)?i.port="80":/^(http|ws)s$/.test(i.protocol)&&(i.port="443")),i.path=i.path||"/";const o=i.host.indexOf(":")!==-1?"["+i.host+"]":i.host;return i.id=i.protocol+"://"+o+":"+i.port+e,i.href=i.protocol+"://"+o+(t&&t.port===i.port?"":":"+i.port),i}const Un=typeof ArrayBuffer=="function",Hn=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n.buffer instanceof ArrayBuffer,Lt=Object.prototype.toString,Fn=typeof Blob=="function"||typeof Blob!="undefined"&&Lt.call(Blob)==="[object BlobConstructor]",Vn=typeof File=="function"||typeof File!="undefined"&&Lt.call(File)==="[object FileConstructor]";function nt(n){return Un&&(n instanceof ArrayBuffer||Hn(n))||Fn&&n instanceof Blob||Vn&&n instanceof File}function Ne(n,e){if(!n||typeof n!="object")return!1;if(Array.isArray(n)){for(let t=0,i=n.length;t<i;t++)if(Ne(n[t]))return!0;return!1}if(nt(n))return!0;if(n.toJSON&&typeof n.toJSON=="function"&&arguments.length===1)return Ne(n.toJSON(),!0);for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t)&&Ne(n[t]))return!0;return!1}function Kn(n){const e=[],t=n.data,i=n;return i.data=it(t,e),i.attachments=e.length,{packet:i,buffers:e}}function it(n,e){if(!n)return n;if(nt(n)){const t={_placeholder:!0,num:e.length};return e.push(n),t}else if(Array.isArray(n)){const t=new Array(n.length);for(let i=0;i<n.length;i++)t[i]=it(n[i],e);return t}else if(typeof n=="object"&&!(n instanceof Date)){const t={};for(const i in n)Object.prototype.hasOwnProperty.call(n,i)&&(t[i]=it(n[i],e));return t}return n}function Yn(n,e){return n.data=st(n.data,e),delete n.attachments,n}function st(n,e){if(!n)return n;if(n&&n._placeholder===!0){if(typeof n.num=="number"&&n.num>=0&&n.num<e.length)return e[n.num];throw new Error("illegal attachments")}else if(Array.isArray(n))for(let t=0;t<n.length;t++)n[t]=st(n[t],e);else if(typeof n=="object")for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&(n[t]=st(n[t],e));return n}const Wn=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var b;(function(n){n[n.CONNECT=0]="CONNECT",n[n.DISCONNECT=1]="DISCONNECT",n[n.EVENT=2]="EVENT",n[n.ACK=3]="ACK",n[n.CONNECT_ERROR=4]="CONNECT_ERROR",n[n.BINARY_EVENT=5]="BINARY_EVENT",n[n.BINARY_ACK=6]="BINARY_ACK"})(b||(b={}));class Jn{constructor(e){this.replacer=e}encode(e){return(e.type===b.EVENT||e.type===b.ACK)&&Ne(e)?this.encodeAsBinary({type:e.type===b.EVENT?b.BINARY_EVENT:b.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===b.BINARY_EVENT||e.type===b.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=Kn(e),i=this.encodeAsString(t.packet),s=t.buffers;return s.unshift(i),s}}class ot extends P{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const i=t.type===b.BINARY_EVENT;i||t.type===b.BINARY_ACK?(t.type=i?b.EVENT:b.ACK,this.reconstructor=new Qn(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(nt(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const i={type:Number(e.charAt(0))};if(b[i.type]===void 0)throw new Error("unknown packet type "+i.type);if(i.type===b.BINARY_EVENT||i.type===b.BINARY_ACK){const o=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const r=e.substring(o,t);if(r!=Number(r)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const c=Number(r);if(!Xn(c)||c<0)throw new Error("Illegal attachments");if(c>this.opts.maxAttachments)throw new Error("too many attachments");i.attachments=c}if(e.charAt(t+1)==="/"){const o=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););i.nsp=e.substring(o,t)}else i.nsp="/";const s=e.charAt(t+1);if(s!==""&&Number(s)==s){const o=t+1;for(;++t;){const r=e.charAt(t);if(r==null||Number(r)!=r){--t;break}if(t===e.length)break}i.id=Number(e.substring(o,t+1))}if(e.charAt(++t)){const o=this.tryParse(e.substr(t));if(ot.isPayloadValid(i.type,o))i.data=o;else throw new Error("invalid payload")}return i}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case b.CONNECT:return $t(t);case b.DISCONNECT:return t===void 0;case b.CONNECT_ERROR:return typeof t=="string"||$t(t);case b.EVENT:case b.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&Wn.indexOf(t[0])===-1);case b.ACK:case b.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class Qn{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=Yn(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const Xn=Number.isInteger||function(n){return typeof n=="number"&&isFinite(n)&&Math.floor(n)===n};function $t(n){return Object.prototype.toString.call(n)==="[object Object]"}const Gn=Object.freeze(Object.defineProperty({__proto__:null,Decoder:ot,Encoder:Jn,get PacketType(){return b}},Symbol.toStringTag,{value:"Module"}));function ee(n,e,t){return n.on(e,t),function(){n.off(e,t)}}const Zn=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class Rt extends P{constructor(e,t,i){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,i&&i.auth&&(this.auth=i.auth),this._opts=Object.assign({},i),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[ee(e,"open",this.onopen.bind(this)),ee(e,"packet",this.onpacket.bind(this)),ee(e,"error",this.onerror.bind(this)),ee(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var i,s,o;if(Zn.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const r={type:b.EVENT,data:t};if(r.options={},r.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const x=this.ids++,A=t.pop();this._registerAckCallback(x,A),r.id=x}const c=(s=(i=this.io.engine)===null||i===void 0?void 0:i.transport)===null||s===void 0?void 0:s.writable,l=this.connected&&!(!((o=this.io.engine)===null||o===void 0)&&o._hasPingExpired());return this.flags.volatile&&!c||(l?(this.notifyOutgoingListeners(r),this.packet(r)):this.sendBuffer.push(r)),this.flags={},this}_registerAckCallback(e,t){var i;const s=(i=this.flags.timeout)!==null&&i!==void 0?i:this._opts.ackTimeout;if(s===void 0){this.acks[e]=t;return}const o=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let c=0;c<this.sendBuffer.length;c++)this.sendBuffer[c].id===e&&this.sendBuffer.splice(c,1);t.call(this,new Error("operation has timed out"))},s),r=(...c)=>{this.io.clearTimeoutFn(o),t.apply(this,c)};r.withError=!0,this.acks[e]=r}emitWithAck(e,...t){return new Promise((i,s)=>{const o=(r,c)=>r?s(r):i(c);o.withError=!0,t.push(o),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const i={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((s,...o)=>(this._queue[0],s!==null?i.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(s)):(this._queue.shift(),t&&t(null,...o)),i.pending=!1,this._drainQueue())),this._queue.push(i),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:b.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(i=>String(i.id)===e)){const i=this.acks[e];delete this.acks[e],i.withError&&i.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case b.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case b.EVENT:case b.BINARY_EVENT:this.onevent(e);break;case b.ACK:case b.BINARY_ACK:this.onack(e);break;case b.DISCONNECT:this.ondisconnect();break;case b.CONNECT_ERROR:this.destroy();const i=new Error(e.data.message);i.data=e.data.data,this.emitReserved("connect_error",i);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const i of t)i.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let i=!1;return function(...s){i||(i=!0,t.packet({type:b.ACK,id:e,data:s}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:b.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const i of t)i.apply(this,e.data)}}}function be(n){n=n||{},this.ms=n.min||100,this.max=n.max||1e4,this.factor=n.factor||2,this.jitter=n.jitter>0&&n.jitter<=1?n.jitter:0,this.attempts=0}be.prototype.duration=function(){var n=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*n);n=(Math.floor(e*10)&1)==0?n-t:n+t}return Math.min(n,this.max)|0},be.prototype.reset=function(){this.attempts=0},be.prototype.setMin=function(n){this.ms=n},be.prototype.setMax=function(n){this.max=n},be.prototype.setJitter=function(n){this.jitter=n};class rt extends P{constructor(e,t){var i;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,Be(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((i=t.randomizationFactor)!==null&&i!==void 0?i:.5),this.backoff=new be({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const s=t.parser||Gn;this.encoder=new s.Encoder,this.decoder=new s.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new jn(this.uri,this.opts);const t=this.engine,i=this;this._readyState="opening",this.skipReconnect=!1;const s=ee(t,"open",function(){i.onopen(),e&&e()}),o=c=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",c),e?e(c):this.maybeReconnectOnOpen()},r=ee(t,"error",o);if(this._timeout!==!1){const c=this._timeout,l=this.setTimeoutFn(()=>{s(),o(new Error("timeout")),t.close()},c);this.opts.autoUnref&&l.unref(),this.subs.push(()=>{this.clearTimeoutFn(l)})}return this.subs.push(s),this.subs.push(r),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push(ee(e,"ping",this.onping.bind(this)),ee(e,"data",this.ondata.bind(this)),ee(e,"error",this.onerror.bind(this)),ee(e,"close",this.onclose.bind(this)),ee(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){Re(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let i=this.nsps[e];return i?this._autoConnect&&!i.active&&i.connect():(i=new Rt(this,e,t),this.nsps[e]=i),i}_destroy(e){const t=Object.keys(this.nsps);for(const i of t)if(this.nsps[i].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let i=0;i<t.length;i++)this.engine.write(t[i],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var i;this.cleanup(),(i=this.engine)===null||i===void 0||i.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const i=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(s=>{s?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",s)):e.onreconnect()}))},t);this.opts.autoUnref&&i.unref(),this.subs.push(()=>{this.clearTimeoutFn(i)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const we={};function Pe(n,e){typeof n=="object"&&(e=n,n=void 0),e=e||{};const t=zn(n,e.path||"/socket.io"),i=t.source,s=t.id,o=t.path,r=we[s]&&o in we[s].nsps,c=e.forceNew||e["force new connection"]||e.multiplex===!1||r;let l;return c?l=new rt(i,e):(we[s]||(we[s]=new rt(i,e)),l=we[s]),t.query&&!e.query&&(e.query=t.queryKey),l.socket(t.path,e)}Object.assign(Pe,{Manager:rt,Socket:Rt,io:Pe,connect:Pe});function ei(n,e,t){const i=n.apiBase||window.location.origin,s=Pe(i,{path:"/livechat-ws",auth:{siteKey:n.siteKey,visitorId:n.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return s.on("livechat:event",o=>{o.sessionId===e&&t(o)}),s}const ti=`
:host {
  all: initial;
  position: fixed;
  bottom: 40px;
  right: 40px;
  z-index: 2147483646;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #1f2937;
  --lc-brand: var(--lc-brand);
  --lc-brand-shadow: var(--lc-brand-shadow);
  --lc-brand-shadow-hover: var(--lc-brand-shadow-hover);
}
:host(.lc-position-left) {
  right: auto;
  left: 40px;
}
@media (max-width: 480px) {
  :host { bottom: 10px; right: 10px; }
  :host(.lc-position-left) { right: auto; left: 10px; }
}

/* ── Bubble button ── */
.lc-bubble {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  cursor: pointer;
  box-shadow: 0 6px 20px var(--lc-brand-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  touch-action: manipulation;
}
.lc-bubble:hover { transform: translateY(-2px); box-shadow: 0 10px 24px var(--lc-brand-shadow-hover); }
.lc-bubble svg { width: 24px; height: 24px; }

.lc-unread {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

/* ── Panel ── */
.lc-panel {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 370px;
  height: 580px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: lc-slide-in 0.22s ease;
}
:host(.lc-position-left) .lc-panel { right: auto; left: 0; }

@keyframes lc-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lc-slide-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(12px); }
}
.lc-panel--closing { animation: lc-slide-out 0.18s ease forwards; }

/* ── Header ── */
.lc-header {
  padding: 14px 16px;
  background: var(--lc-brand);
  background-image: radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px);
  background-size: 18px 18px;
  color: #fff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.lc-header-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; width: 100%; }
.lc-header-inner { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.lc-header-sub-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.9;
  color: #fff;
}
.lc-header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  border: 2px solid rgba(255,255,255,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lc-header-avatar svg { width: 20px; height: 20px; }
.lc-header-avatars { display: flex; align-items: center; flex-shrink: 0; position: relative; }
.lc-op-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.85);
  object-fit: cover;
  flex-shrink: 0;
  position: relative;
}
.lc-op-initials {
  background: rgba(255,255,255,0.22);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lc-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lc-header-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-header-sub { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 5px; }
.lc-online-dot { width: 7px; height: 7px; background: #22c55e; border-radius: 50%; flex-shrink: 0; display: inline-block; }

.lc-header-actions { display: flex; align-items: center; gap: 6px; position: relative; }

.lc-newchat-btn,
.lc-close, .lc-menu-btn {
  background: rgba(255,255,255,0.15);
  border: 0;
  color: #fff;
  cursor: pointer;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
  padding: 0;
}
.lc-newchat-btn:hover,
.lc-close:hover, .lc-menu-btn:hover { background: rgba(255,255,255,0.28); }
.lc-newchat-btn svg,
.lc-close svg, .lc-menu-btn svg { width: 16px; height: 16px; }

.lc-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: #fff;
  color: #111827;
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.18);
  min-width: 220px;
  padding: 6px;
  z-index: 10;
}
.lc-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}
.lc-menu-item:hover { background: #f3f4f6; }
.lc-menu-item svg { width: 14px; height: 14px; flex-shrink: 0; color: #6b7280; }

.lc-md-code {
  background: rgba(0,0,0,0.06);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.92em;
}

.lc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.lc-chip {
  background: #fff;
  border: 1px solid var(--lc-brand, #2563eb);
  color: var(--lc-brand, #2563eb);
  border-radius: 16px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.lc-chip:hover {
  background: var(--lc-brand, #2563eb);
  color: #fff;
}

.lc-feedback {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0,0,0,0.04);
  padding: 6px 10px;
  border-radius: 10px;
  margin: 8px auto;
}
.lc-feedback span { font-size: 12px; color: #4b5563; }
.lc-fb-btn {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.1s;
}
.lc-fb-btn:hover { transform: scale(1.15); }

/* Higher specificity than the global .lc-composer button rule below — the
   picker button + tabs + grid items live inside .lc-composer so without
   this they'd inherit the brand-blue circle styling. */
.lc-composer .lc-emoji-btn {
  background: transparent;
  border: 0;
  color: #6b7280;
  cursor: pointer;
  padding: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.lc-composer .lc-emoji-btn:hover { background: #f3f4f6; color: #111827; }
.lc-composer .lc-emoji-btn svg { width: 18px; height: 18px; }

.lc-emoji-pop {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 8px;
  width: 280px;
  max-width: calc(100% - 16px);
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.15);
  z-index: 12;
  overflow: hidden;
}
.lc-emoji-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}
.lc-composer .lc-emoji-tab {
  background: transparent;
  border: 0;
  padding: 8px 10px;
  width: auto;
  height: auto;
  border-radius: 0;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}
.lc-composer .lc-emoji-tab:hover { color: #111827; background: transparent; }
.lc-composer .lc-emoji-tab-active { color: #111827; border-bottom-color: var(--lc-brand, #2563eb); font-weight: 600; }
.lc-emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  padding: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.lc-composer .lc-emoji-pick {
  background: transparent;
  border: 0;
  padding: 4px;
  width: auto;
  height: 32px;
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  line-height: 1;
  color: inherit;
}
.lc-composer .lc-emoji-pick:hover { background: #f3f4f6; }

.lc-composer { position: relative; }

/* ── Messages area ── */
.lc-messages-wrap { flex: 1; overflow: hidden; position: relative; min-height: 0; }

.lc-messages {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 14px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
}
.lc-messages::-webkit-scrollbar { width: 4px; }
.lc-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

/* ── Message rows ── */
.lc-msg-row { display: flex; align-items: flex-end; gap: 7px; max-width: 86%; }
.lc-msg-row-agent { align-self: flex-start; }
.lc-msg-row-visitor { align-self: flex-end; flex-direction: row-reverse; }

.lc-msg-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--lc-brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 2px;
}
.lc-msg-avatar svg { width: 13px; height: 13px; }
.lc-msg-avatar-op { background: #374151; font-size: 10px; font-weight: 700; letter-spacing: 0.02em; }
.lc-msg-avatar-ai { background: var(--lc-brand); }
.lc-msg-avatar-img { object-fit: cover; padding: 0; }

.lc-msg-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.lc-msg-row-visitor .lc-msg-body { align-items: flex-end; }

.lc-msg-sender { font-size: 11px; color: #6b7280; font-weight: 500; padding: 0 3px; }
.lc-msg-time { font-size: 10px; color: #9ca3af; padding: 0 3px; }

.lc-msg { padding: 9px 13px; border-radius: 16px; font-size: 14px; line-height: 1.45; word-wrap: break-word; overflow-wrap: anywhere; }
.lc-msg.lc-msg-visitor { background: var(--lc-brand); color: #fff; border-bottom-right-radius: 4px; }
.lc-msg.lc-msg-agent { background: #fff; color: #1f2937; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
.lc-msg.lc-msg-system { align-self: center; font-size: 11px; color: #9ca3af; background: transparent; padding: 4px 0; }
.lc-msg a { color: inherit; text-decoration: underline; word-break: break-all; }
.lc-msg.lc-msg-agent a { color: #2563eb; }
.lc-empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 32px 16px; line-height: 1.5; }

/* ── Typing indicator ── */
.lc-typing {
  align-self: flex-start;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  padding: 10px 14px;
  display: flex;
  gap: 4px;
  margin-left: 33px;
}
.lc-typing span { width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: lc-bounce 1.2s infinite ease-in-out; }
.lc-typing span:nth-child(2) { animation-delay: 0.15s; }
.lc-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes lc-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

/* ── Scroll-to-bottom button ── */
.lc-scroll-btn {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.12);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
}
.lc-scroll-btn:hover { background: #f9fafb; }
.lc-scroll-btn svg { width: 13px; height: 13px; color: #6b7280; }

/* ── Toast notification ── */
.lc-toast {
  padding: 8px 14px;
  background: #1f2937;
  color: #f9fafb;
  font-size: 12px;
  text-align: center;
  flex-shrink: 0;
}

/* ── Human queue banner ── */
.lc-queue-banner {
  padding: 8px 14px;
  background: #fefce8;
  border-top: 1px solid #fde68a;
  color: #92400e;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.lc-queue-banner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f59e0b;
  flex-shrink: 0;
  animation: lc-pulse 1.4s ease-in-out infinite;
}
@keyframes lc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* ── In-widget confirm dialog ── */
.lc-confirm {
  position: absolute;
  inset: 0;
  background: rgba(17,24,39,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  border-radius: inherit;
}
.lc-confirm-box {
  background: #fff;
  border-radius: 14px;
  padding: 20px 18px 16px;
  width: calc(100% - 40px);
  max-width: 280px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.22);
}
.lc-confirm-msg {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.5;
  color: #111827;
  text-align: center;
}
.lc-confirm-actions {
  display: flex;
  gap: 8px;
}
.lc-confirm-cancel,
.lc-confirm-ok {
  flex: 1;
  border: 0;
  border-radius: 8px;
  padding: 9px 0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.lc-confirm-cancel {
  background: #f3f4f6;
  color: #374151;
}
.lc-confirm-cancel:hover { background: #e5e7eb; }
.lc-confirm-ok {
  background: var(--lc-brand, #2563eb);
  color: #fff;
}
.lc-confirm-ok:hover { opacity: 0.88; }

/* ── Quick replies ── */
.lc-quick-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 14px 8px;
  background: #f9fafb;
  flex-shrink: 0;
}
.lc-quick-replies button {
  background: #fff;
  border: 1px solid var(--lc-brand);
  color: var(--lc-brand);
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}
.lc-quick-replies button:hover { background: var(--lc-brand); color: #fff; }
.lc-quick-replies button:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Inline identify (rendered as an agent bubble) ── */
.lc-inline-identify {
  padding: 10px 12px !important;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
}
.lc-inline-prompt { font-size: 13px; line-height: 1.4; color: #1f2937; }
.lc-inline-greet { color: var(--lc-brand, #2563eb); font-weight: 600; }
.lc-inline-row { display: flex; gap: 6px; align-items: stretch; }
.lc-inline-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font: inherit;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}
.lc-inline-input:focus { border-color: var(--lc-brand, #2563eb); }
.lc-inline-input--invalid { border-color: #ef4444 !important; background: #fef2f2 !important; }
.lc-inline-save {
  background: var(--lc-brand, #2563eb);
  border: 0;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
}
.lc-inline-save:hover { opacity: 0.9; }
.lc-inline-save svg { width: 14px; height: 14px; }
.lc-inline-skip {
  align-self: flex-start;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 11px;
  padding: 0;
  cursor: pointer;
  font: inherit;
}
.lc-inline-skip:hover { color: #6b7280; }
.lc-inline-error {
  font-size: 11px;
  color: #ef4444;
  margin-top: -4px;
}

/* ── Pending attachments ── */
@keyframes lc-spin { to { transform: rotate(360deg); } }
.lc-pending { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px 0 12px; background: #fff; flex-shrink: 0; }
.lc-chip { display: inline-flex; align-items: center; gap: 6px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px 8px; font-size: 12px; color: #1f2937; max-width: 240px; }
.lc-chip--busy { opacity: 0.85; border-style: dashed; }
.lc-chip-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.lc-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-chip-uploading { color: #6b7280; }
.lc-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #e5e7eb; border-top-color: #6b7280; border-radius: 50%; flex-shrink: 0; animation: lc-spin 0.8s linear infinite; }
.lc-chip button { background: transparent; border: 0; padding: 0 0 0 2px; cursor: pointer; color: #6b7280; font-size: 14px; line-height: 1; }
.lc-chip button:hover { color: #1f2937; }

/* ── Session ended banner ── */
.lc-session-end {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: #fef9ec;
  border-top: 1px solid #fde68a;
  font-size: 12px;
  color: #92400e;
  flex-shrink: 0;
}
.lc-session-end-btn {
  background: #1f2937;
  color: #fff;
  border: 0;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.lc-session-end-btn:hover { background: #374151; }

/* ── Composer ── */
.lc-composer {
  border-top: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  align-items: flex-end;
  flex-shrink: 0;
}
.lc-composer textarea {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 8px 10px;
  resize: none;
  font: inherit;
  font-size: 14px;
  outline: none;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.4;
  color: inherit;
}
.lc-composer textarea:focus { border-color: var(--lc-brand); }
.lc-composer button {
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.lc-composer button:disabled { opacity: 0.4; cursor: not-allowed; }
.lc-composer button svg { width: 16px; height: 16px; }

/* ── Honeypot ── */
.lc-hp { position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0; }

/* ── Attach button ── */
/* .lc-composer .lc-attach-btn wins over .lc-composer button (specificity 0,2,0 > 0,1,1) */
.lc-composer .lc-attach-btn { background: transparent; border: 0; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #6b7280; cursor: pointer; flex-shrink: 0; }
.lc-composer .lc-attach-btn:hover { background: #f3f4f6; color: #1f2937; }
.lc-attach-btn svg { width: 18px; height: 18px; }

/* ── Attachments in messages ── */
.lc-attachments { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.lc-attach-img { display: block; width: 100%; max-width: 220px; min-width: 80px; min-height: 60px; max-height: 200px; object-fit: contain; border-radius: 10px; cursor: zoom-in; background: #f3f4f6; }
.lc-attach-file { display: inline-flex; align-items: center; gap: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; font-size: 12px; color: #1f2937; text-decoration: none; max-width: 240px; }
.lc-attach-file:hover { background: #e5e7eb; }
.lc-attach-file svg { width: 16px; height: 16px; flex-shrink: 0; color: #6b7280; }
.lc-attach-file span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.lc-attach-file .lc-attach-size { color: #6b7280; flex-shrink: 0; }

/* ── Per-message rating ── */
.lc-msg-rating {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.lc-msg-row:hover .lc-msg-rating { opacity: 1; }
.lc-rate-btn {
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
  transition: background 0.12s, border-color 0.12s;
}
.lc-rate-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #d1d5db; }
.lc-rate-btn:disabled { cursor: default; opacity: 0.5; }
.lc-rate-btn--active { background: #f0fdf4; border-color: #86efac; }

/* ── Streaming cursor ── */
.lc-msg--streaming {
  min-height: 1.4em;
}
.lc-msg--streaming::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 0.85em;
  background: currentColor;
  opacity: 0.6;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: lc-cursor-blink 0.55s steps(1) infinite;
}
@keyframes lc-cursor-blink {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0; }
}

/* ── Incoming message preview popup ── */
.lc-msg-preview {
  position: absolute;
  bottom: 76px;
  right: 0;
  width: 280px;
  max-width: calc(100vw - 80px);
  background: #1e293b;
  color: #f1f5f9;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.28), 0 2px 8px rgba(15, 23, 42, 0.12);
  padding: 12px 36px 12px 14px;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
  animation: lc-slide-in 0.25s ease;
  word-break: break-word;
}
:host(.lc-position-left) .lc-msg-preview {
  right: auto;
  left: 0;
  border-radius: 18px 18px 18px 4px;
}
.lc-msg-preview-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: 0;
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.lc-msg-preview-close:hover { color: #f1f5f9; background: rgba(255,255,255,0.1); }
.lc-msg-preview-text { display: block; }

/* ── Proactive welcome bubble ── */
/* Styled as a chat bubble pointing down at the chat-launcher button.
   Width is fixed (not max-width) because the host has no intrinsic width;
   without an explicit width the bubble shrinks to longest-word size. */
.lc-proactive {
  position: absolute;
  bottom: 76px;
  right: 0;
  width: 280px;
  max-width: calc(100vw - 80px);
  background: #fff;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08);
  padding: 14px 18px 14px 16px;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.5;
  animation: lc-slide-in 0.3s ease;
}
:host(.lc-position-left) .lc-proactive {
  right: auto;
  left: 0;
  border-radius: 18px 18px 18px 4px;
}
.lc-proactive-text { cursor: pointer; padding-right: 18px; }
.lc-proactive-text:hover { text-decoration: none; }
.lc-proactive-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.lc-proactive-close:hover { color: #374151; background: #f3f4f6; }

/* ── Mobile ── */
/* On mobile the host is sized via the Visual Viewport API so it tracks
   exactly the visible area — URL bar, keyboard, and safe-area are all
   accounted for in JS. The panel fills 100% of that host element. */
@media (max-width: 480px) {
  .lc-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
    /* Block touch events from reaching the page behind the panel. */
    touch-action: none;
  }
  /* Safe-area insets: notch / status bar (top) and home indicator (bottom). */
  .lc-header {
    padding-top: calc(14px + env(safe-area-inset-top, 0px));
  }
  .lc-composer {
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }
  /* Allow vertical scroll in the messages area only. */
  .lc-messages {
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  /* Prevent iOS Safari from zooming in when an input is focused.
     Any font-size below 16px triggers the auto-zoom. */
  .lc-composer textarea,
  .lc-identify input {
    font-size: 16px;
  }
  /* Expand tap targets to the 44px minimum recommended for touch. */
  .lc-close {
    width: 44px;
    height: 44px;
  }
  .lc-composer .lc-attach-btn {
    width: 44px;
    height: 44px;
  }
  .lc-composer .lc-emoji-btn {
    width: 44px;
    height: 44px;
  }
  .lc-composer button[type="submit"] {
    width: 44px;
    height: 44px;
  }
  /* Prevent double-tap zoom on all interactive elements. */
  .lc-close, .lc-menu-btn, .lc-newchat-btn,
  .lc-attach-btn, .lc-emoji-btn,
  .lc-composer button[type="submit"],
  .lc-rate-btn, .lc-chip, .lc-fb-btn,
  .lc-quick-replies button, .lc-session-end-btn {
    touch-action: manipulation;
  }
  /* Rating buttons: always visible on touch (no hover state). */
  .lc-msg-rating {
    opacity: 1;
  }
  /* Proactive bubble: keep it within the viewport on narrow screens. */
  .lc-proactive {
    max-width: calc(100vw - 60px);
    right: 0;
  }
  /* Emoji picker: clamp width so it never overflows the panel edge. */
  .lc-emoji-pop {
    left: 0;
    right: 0;
    width: auto;
    max-width: 100%;
    border-radius: 12px 12px 0 0;
    bottom: calc(100% + 4px);
  }
}

/* Landscape + soft keyboard: very short viewport — tighten spacing so the
   composer stays visible without sacrificing the message area. */
@media (max-width: 480px) and (max-height: 400px) {
  .lc-header { padding-top: calc(8px + env(safe-area-inset-top, 0px)); padding-bottom: 8px; }
  .lc-messages { padding: 6px 12px; }
  .lc-composer { padding-top: 6px; padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)); }
  /* Emoji picker: shrink grid so it doesn't overflow the compressed panel. */
  .lc-emoji-grid { max-height: 110px; }
}
/* Portrait + soft keyboard: medium-height viewport (keyboard visible but not landscape).
   Reduce picker height so it fits between the header and composer. */
@media (max-width: 480px) and (min-height: 401px) and (max-height: 600px) {
  .lc-emoji-grid { max-height: 150px; }
}
`,at=[{name:"Smileys",emojis:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","🙄","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤐","🤨","😐","😑","😶","😏","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷"]},{name:"Hearts",emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"]},{name:"Hands",emojis:["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤝","🙏","✍️","💪","🦾"]},{name:"Objects",emojis:["🔥","✨","🎉","🎊","🎁","🏆","🥇","⭐","🌟","💫","💥","💯","✅","❌","⚠️","❓","❗","💡","📌","📎","🔗","🔒","🔑","⏰","⏳","📅","📆","🗓️","📊","📈"]},{name:"Travel",emojis:["🚀","✈️","🚗","🚕","🚙","🚌","🏠","🏢","🏥","🏦","🏪","🏫","⛺","🌍","🌎","🌏","🗺️","🏖️","🏔️","🌋"]}],ni=[[":)","🙂"],[":-)","🙂"],[":D","😄"],[":-D","😄"],["xD","😆"],["XD","😆"],[":P","😛"],[":p","😋"],[":-P","😛"],[":'(","😢"],[":(","🙁"],[":-(","🙁"],[";)","😉"],[";-)","😉"],[":O","😮"],[":o","😮"],[":-O","😮"],[":oO","😳"],[":|","😐"],[":-|","😐"],[":/","😕"],[":-/","😕"],["<3","❤️"],["</3","💔"],[":*","😘"],["B)","😎"]];function ii(n){let e=n;for(const[t,i]of ni){const s=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),o=new RegExp(`(^|\\s)${s}(?=\\s|$|[.,!?])`,"g");e=e.replace(o,`$1${i}`)}return e}const si="https://gist.githubusercontent.com/Sharifur/b40c7b54b97d43f353f1382e51c70535/raw/f6446fa378bf266cacf604f1e97f8f318e01e157/temporary-email-address-domain-list.json",Bt="livechat_disposable_domains",qt="livechat_disposable_domains_ts",oi=1440*60*1e3;let de=null;async function Nt(){if(de)return de;try{const n=localStorage.getItem(qt),e=localStorage.getItem(Bt),t=n?Number(n):0;if(e&&t&&Date.now()-t<oi){const i=JSON.parse(e);return de=new Set(i.map(s=>s.toLowerCase())),de}}catch(n){}try{const n=new AbortController,e=setTimeout(()=>n.abort(),4e3),t=await fetch(si,{signal:n.signal});if(clearTimeout(e),t.ok){const i=await t.json(),o=(Array.isArray(i)?i:[]).map(r=>String(r).trim().toLowerCase()).filter(Boolean);de=new Set(o);try{localStorage.setItem(Bt,JSON.stringify(o)),localStorage.setItem(qt,String(Date.now()))}catch(r){}return de}}catch(n){}return de=new Set(["mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com","temp-mail.org","yopmail.com","trashmail.com","fakeinbox.com","throwawaymail.com","getairmail.com","sharklasers.com"]),de}async function ri(n){const e=n.lastIndexOf("@");if(e<0)return!1;const t=n.slice(e+1).trim().toLowerCase();return t?(await Nt()).has(t):!1}function ai(){Nt()}const ci={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},Me="livechat_messages_cache_v2",Pt="livechat_cache_bust",ct="livechat_session_id",De="livechat_identify_dismissed",je="livechat_identify_name",fe="livechat_identify_email",Mt="livechat_send_log",ze="livechat_proactive_seen",li=30,di=6e4,pi=3;function hi(n,e=ci){var ge,N,Fe,ye,Ce;ki(n.siteKey,e.cacheBust);const t=Date.now(),i=document.createElement("div");i.id="livechat-widget-root";const s=()=>window.innerWidth<=480,o="10px",r="10px",c="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",l=`position: fixed; bottom: ${o}; right: ${r}; z-index: 2147483646;`;i.style.cssText=s()?l:c,document.body.appendChild(i);const y=i.attachShadow({mode:"open"}),x=(ge=Si(e.brandColor))!=null?ge:"#2563eb",A=Ht(x,.35),k=Ht(x,.45);i.style.setProperty("--lc-brand",x),i.style.setProperty("--lc-brand-shadow",A),i.style.setProperty("--lc-brand-shadow-hover",k),((N=n.position)!=null?N:e.position)==="bottom-left"&&i.classList.add("lc-position-left");const te=document.createElement("style");te.textContent=ti,y.appendChild(te);const ne=()=>{i.style.setProperty("--lc-brand",x),i.style.setProperty("--lc-brand-shadow",A),i.style.setProperty("--lc-brand-shadow-hover",k)},p={open:!1,sessionId:vi(),messages:_i(),socket:null,panel:null,askedForEmail:!1,askedForName:!1,knownName:gi(),unread:0,sessionClosed:!1,feedbackAsked:!1,operators:(Fe=e.operators)!=null?Fe:[],host:i,cfg:n,reapplyCssVars:ne,activeDraftId:null,historyPushed:!1,pendingTrigger:void 0,closePanelAnim:void 0,collectPageContext:void 0,requireEmail:(ye=e.requireEmail)!=null?ye:!1,showMsgPreview:void 0,startQueuePolling:void 0,stopQueuePolling:void 0},_=document.createElement("button");_.className="lc-bubble",_.setAttribute("aria-label","Open chat"),_.setAttribute("title","Open chat"),_.type="button",_.innerHTML=$i(),y.appendChild(_);const q=document.createElement("span");q.className="lc-unread",q.style.display="none",_.appendChild(q);const D=document.createElement("div");if(D.className="lc-proactive",D.style.display="none",e.welcomeMessage){D.innerHTML=`
      <button class="lc-proactive-close" aria-label="Dismiss">&#x2715;</button>
      <div class="lc-proactive-text">${M(e.welcomeMessage)}</div>
    `,y.appendChild(D);let f=!1;try{f=!!sessionStorage.getItem(ze)}catch(v){}n.popup!==!1&&!f&&setTimeout(()=>{p.open||(D.style.display="block")},(Ce=n.popupDelay)!=null?Ce:1500),D.querySelector(".lc-proactive-close").addEventListener("click",v=>{v.stopPropagation(),D.style.display="none";try{sessionStorage.setItem(ze,"1")}catch(L){}}),D.querySelector(".lc-proactive-text").addEventListener("click",()=>{D.style.display="none";try{sessionStorage.setItem(ze,"1")}catch(v){}_.click()})}const R=document.createElement("div");R.className="lc-msg-preview",R.style.display="none",R.innerHTML='<button class="lc-msg-preview-close" aria-label="Dismiss">&#x2715;</button><span class="lc-msg-preview-text"></span>',y.appendChild(R);let j=null;function oe(f){if(p.open)return;const v=f.replace(/__[a-z_]+__/g,"").trim();if(!v)return;const L=v.length>90?v.slice(0,87)+"...":v,K=R.querySelector(".lc-msg-preview-text");K&&(K.textContent=L),R.style.display="block",j&&clearTimeout(j),j=setTimeout(()=>{R.style.display="none"},6e3)}R.addEventListener("click",f=>{if(f.target.closest(".lc-msg-preview-close")){R.style.display="none",j&&(clearTimeout(j),j=null);return}R.style.display="none",p.open=!0,Se()}),p.messages.length===0&&e.welcomeMessage&&(p.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),pe(p.messages));const g=ui(y,n,p,Ae,e);g.style.display="none",p.panel=g,g._state=p,g._cfg=n;function he(){const f=window.visualViewport;f?i.style.cssText=`position: fixed; top: ${f.offsetTop}px; left: ${f.offsetLeft}px; width: ${f.width}px; height: ${f.height}px; z-index: 2147483646;`:i.style.cssText="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;",ne()}let h=null;function S(){h!==null&&cancelAnimationFrame(h),h=requestAnimationFrame(()=>{h=null,p.open&&(s()?he():(i.style.cssText=c,ne()))})}let V=!1;function W(){V||!window.visualViewport||(V=!0,window.visualViewport.addEventListener("resize",S),window.visualViewport.addEventListener("scroll",S),window.addEventListener("orientationchange",()=>{setTimeout(S,150)}))}window.addEventListener("popstate",()=>{p.open&&p.historyPushed&&(p.historyPushed=!1,Ee())});function re(){var v,L,K,Y;const f={};try{const C=document.body.scrollHeight-window.innerHeight;f.scrollDepth=C>0?Math.round(window.scrollY/C*100):100}catch(C){}f.timeOnPageSec=Math.round((Date.now()-t)/1e3);try{const C=(L=(v=document.querySelector("h1"))==null?void 0:v.textContent)==null?void 0:L.trim().slice(0,100);C&&(f.pageH1=C)}catch(C){}try{const C=(Y=(K=document.querySelector('meta[name="description"]'))==null?void 0:K.content)==null?void 0:Y.trim().slice(0,200);C&&(f.metaDescription=C)}catch(C){}try{const C=new URLSearchParams(window.location.search);C.get("utm_source")&&(f.utmSource=C.get("utm_source").slice(0,80)),C.get("utm_campaign")&&(f.utmCampaign=C.get("utm_campaign").slice(0,80)),C.get("utm_medium")&&(f.utmMedium=C.get("utm_medium").slice(0,80)),C.get("utm_term")&&(f.utmTerm=C.get("utm_term").slice(0,80))}catch(C){}try{document.referrer&&(f.referrerDomain=new URL(document.referrer).hostname.slice(0,100))}catch(C){}try{f.isReturnVisitor=!!localStorage.getItem("livechat_session_id")}catch(C){}return p.pendingTrigger&&(f.triggeredBy=p.pendingTrigger.slice(0,100),p.pendingTrigger=void 0),n.context&&Object.keys(n.context).length&&(f.custom=n.context),f}p.collectPageContext=re,document.addEventListener("click",f=>{var L;const v=f.target.closest("[data-lc-open]");v&&(f.preventDefault(),p.pendingTrigger=(L=v.getAttribute("data-lc-open"))!=null?L:void 0,p.open||(p.open=!0,Se()))});function Se(){var f;if(s()){he(),W();try{history.pushState({lcPanel:!0},""),p.historyPushed=!0}catch(v){}}g.classList.remove("lc-panel--closing"),g.style.display="flex",p.unread=0,q.style.display="none",R.style.display="none",j&&(clearTimeout(j),j=null),jt(g),lt(p),(f=g.querySelector("textarea"))==null||f.focus()}function Ee(){p.open=!1,g.classList.add("lc-panel--closing"),setTimeout(()=>{p.open||(g.style.display="none",s()&&(i.style.cssText=l,ne())),g.classList.remove("lc-panel--closing")},180)}p.closePanelAnim=Ee,_.addEventListener("click",()=>{D.style.display="none";try{sessionStorage.setItem(ze,"1")}catch(f){}if(p.open=!p.open,p.open)Se();else{if(p.historyPushed){p.historyPushed=!1;try{history.back()}catch(f){}}Ee()}}),p.showMsgPreview=oe,p.sessionId&&Dt(n,p,Ae,e),ai();let ue=null;function me(f){const v=p.panel,L=v==null?void 0:v.querySelector(".lc-queue-banner-text");L&&(f<=0?L.textContent="Waiting for a human agent…":f===1?L.textContent="You are next in queue — an agent will join shortly.":L.textContent=`You are #${f} in queue — an agent will join shortly.`)}function Te(){ue||(He(),ue=setInterval(()=>{He()},3e4))}function Ie(){ue&&(clearInterval(ue),ue=null)}p.startQueuePolling=Te,p.stopQueuePolling=Ie;async function He(){var v;const f=p.sessionId;if(f)try{const L=await fetch(`${n.apiBase}/livechat/session/${encodeURIComponent(f)}/queue?siteKey=${encodeURIComponent(n.siteKey)}&visitorId=${encodeURIComponent(n.visitorId)}`,{credentials:"omit"});if(!L.ok)return;const K=await L.json();if(K.status!=="needs_human"){const Y=p.panel,C=Y==null?void 0:Y.querySelector(".lc-queue-banner");C&&(C.style.display="none"),Ie();return}me((v=K.position)!=null?v:0)}catch(L){}}p.sessionId&&(async()=>{var f;try{const v=await fetch(`${n.apiBase}/livechat/session/${encodeURIComponent(p.sessionId)}/queue?siteKey=${encodeURIComponent(n.siteKey)}&visitorId=${encodeURIComponent(n.visitorId)}`,{credentials:"omit"});if(v.ok){const L=await v.json();if(L.status==="needs_human"){const K=p.panel,Y=K==null?void 0:K.querySelector(".lc-queue-banner");Y&&(Y.style.display="flex"),me((f=L.position)!=null?f:0),Te()}}}catch(v){}})();function Ae(){fi(g,p),!p.open&&p.unread>0?(q.textContent=String(Math.min(p.unread,99)),q.style.display="flex"):q.style.display="none"}Ae(),n.autoOpen&&setTimeout(()=>{_.click()},0)}function ui(n,e,t,i,s){var Gt,Zt,en,tn;const o=document.createElement("div");o.className="lc-panel";const c=((Gt=s.operators)!=null?Gt:[]).length>1?((Zt=s.botName)==null?void 0:Zt.trim())||s.operatorName||"Chat with us":((en=s.operatorName)==null?void 0:en.trim())||s.botName;o.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-top">
        <div class="lc-header-inner">
          ${Di((tn=s.operators)!=null?tn:[],s.operatorName)}
          <div class="lc-header-text">
            <div class="lc-header-title">${M(c)}</div>
          </div>
        </div>
        <div class="lc-header-actions">
          <button class="lc-newchat-btn" aria-label="Start new conversation">${Mi()}</button>
          <button class="lc-menu-btn" aria-label="Conversation menu" aria-haspopup="true">${Bi()}</button>
          <div class="lc-menu" role="menu" style="display:none;">
            <button class="lc-menu-item" data-action="new">${qi()} Start a new conversation</button>
            <button class="lc-menu-item" data-action="close">${Ni()} End this chat</button>
          </div>
          <button class="lc-close" aria-label="Close">${Ft()}</button>
        </div>
      </div>
      <div class="lc-header-sub-row">
        <span class="lc-online-dot"></span>${M(s.botSubtitle)}
      </div>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${Ft()} New messages</button>
    </div>
    <div class="lc-quick-replies" style="display:none;"></div>
    <div class="lc-toast" role="alert" style="display:none;"></div>
    <div class="lc-queue-banner" style="display:none;">
      <span class="lc-queue-banner-dot"></span>
      <span class="lc-queue-banner-text">Waiting for a human agent…</span>
    </div>
    <div class="lc-pending" style="display:none;"></div>
    <div class="lc-session-end" style="display:none;">
      <span>This conversation has ended.</span>
      <button type="button" class="lc-session-end-btn">Start new chat</button>
    </div>
    <div class="lc-confirm" style="display:none;" role="dialog" aria-modal="true">
      <div class="lc-confirm-box">
        <p class="lc-confirm-msg"></p>
        <div class="lc-confirm-actions">
          <button type="button" class="lc-confirm-cancel">Cancel</button>
          <button type="button" class="lc-confirm-ok">Confirm</button>
        </div>
      </div>
    </div>
    <form class="lc-composer" autocomplete="off">
      <input class="lc-hp" name="website" tabindex="-1" autocomplete="off" />
      <input class="lc-file-input" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none;" />
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${Oi()}</button>
      <button type="button" class="lc-emoji-btn" aria-label="Insert emoji">${Pi()}</button>
      <div class="lc-emoji-pop" style="display:none;" role="dialog" aria-label="Emoji picker">
        <div class="lc-emoji-tabs">${at.map((a,d)=>`<button type="button" class="lc-emoji-tab${d===0?" lc-emoji-tab-active":""}" data-cat="${d}">${a.name}</button>`).join("")}</div>
        <div class="lc-emoji-grid">${at[0].emojis.map(a=>`<button type="button" class="lc-emoji-pick" data-emoji="${a}">${a}</button>`).join("")}</div>
      </div>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${Vt()}</button>
    </form>
  `,n.appendChild(o);const y=t.host.classList.contains("lc-position-left")?"position: fixed; bottom: 10px; left: 10px; z-index: 2147483646;":"position: fixed; bottom: 10px; right: 10px; z-index: 2147483646;",x=o.querySelector(".lc-confirm"),A=o.querySelector(".lc-confirm-msg"),k=o.querySelector(".lc-confirm-ok"),$=o.querySelector(".lc-confirm-cancel");function te(a,d,u){A.textContent=a,k.textContent=d,x.style.display="flex";const E=()=>{x.style.display="none"},m=()=>{E(),$.removeEventListener("click",T),u()},T=()=>{E(),k.removeEventListener("click",m)};k.addEventListener("click",m,{once:!0}),$.addEventListener("click",T,{once:!0})}o.querySelector(".lc-newchat-btn").addEventListener("click",()=>{te("Start a new conversation? The current chat will be cleared.","Start new",ge)}),o.querySelector(".lc-close").addEventListener("click",()=>{if(t.historyPushed){t.historyPushed=!1;try{history.back()}catch(a){}}if(t.closePanelAnim){t.closePanelAnim();return}t.open=!1,o.classList.add("lc-panel--closing"),setTimeout(()=>{var a;o.style.display="none",window.innerWidth<=480&&(t.host.style.cssText=y,(a=t.reapplyCssVars)==null||a.call(t)),o.classList.remove("lc-panel--closing")},180)});const _=o.querySelector(".lc-menu-btn"),q=o.querySelector(".lc-menu"),D=()=>{q.style.display="none"};_.addEventListener("click",a=>{a.stopPropagation(),q.style.display=q.style.display==="none"?"block":"none"}),o.addEventListener("click",a=>{!q.contains(a.target)&&a.target!==_&&D()}),q.addEventListener("click",async a=>{const d=a.target.closest(".lc-menu-item");if(!d)return;D();const u=d.getAttribute("data-action");u==="new"?te("Start a new conversation? The current chat will be cleared.","Start new",ge):u==="close"&&te("End this chat? You can always start a new one.","End chat",async()=>{const E=t.sessionId;if(E)try{await fetch(`${e.apiBase}/livechat/session/${encodeURIComponent(E)}/close`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:e.siteKey,visitorId:e.visitorId}),credentials:"omit"})}catch(m){}ge(),t.messages=[{id:`system-${Date.now()}`,role:"system",content:"Chat ended. Type a message to start a new conversation.",createdAt:new Date().toISOString()}],pe(t.messages),i()})});const R=o.querySelector(".lc-messages"),j=o.querySelector(".lc-scroll-btn");R.addEventListener("scroll",()=>{const a=R.scrollHeight-R.scrollTop-R.clientHeight;j.style.display=a>120?"flex":"none"}),j.addEventListener("click",()=>{R.scrollTop=R.scrollHeight,j.style.display="none"});const oe=o.querySelector(".lc-composer"),g=o.querySelector("textarea"),he=o.querySelector(".lc-hp"),h=o.querySelector('.lc-composer button[type="submit"]'),S=o.querySelector(".lc-attach-btn"),V=o.querySelector(".lc-file-input"),W=o.querySelector(".lc-pending"),re=o.querySelector(".lc-quick-replies"),Se=o.querySelector(".lc-session-end"),Ee=o.querySelector(".lc-session-end-btn"),ue=o.querySelector(".lc-emoji-btn"),me=o.querySelector(".lc-emoji-pop"),Te=o.querySelector(".lc-emoji-tabs"),Ie=o.querySelector(".lc-emoji-grid");function He(a){var m,T;const d=(m=g.selectionStart)!=null?m:g.value.length,u=(T=g.selectionEnd)!=null?T:d;g.value=g.value.slice(0,d)+a+g.value.slice(u);const E=d+a.length;g.setSelectionRange(E,E),g.focus()}function Ae(a){const d=at[a];d&&(Ie.innerHTML=d.emojis.map(u=>`<button type="button" class="lc-emoji-pick" data-emoji="${u}">${u}</button>`).join(""))}ue.addEventListener("click",a=>{a.stopPropagation(),me.style.display=me.style.display==="none"?"block":"none"}),o.addEventListener("click",a=>{a.target instanceof Node&&!me.contains(a.target)&&a.target!==ue&&(me.style.display="none")}),Te.addEventListener("click",a=>{var u;const d=a.target.closest(".lc-emoji-tab");d&&(Te.querySelectorAll(".lc-emoji-tab").forEach(E=>E.classList.remove("lc-emoji-tab-active")),d.classList.add("lc-emoji-tab-active"),Ae(Number((u=d.getAttribute("data-cat"))!=null?u:0)))}),Ie.addEventListener("click",a=>{var u;const d=a.target.closest(".lc-emoji-pick");d&&He((u=d.getAttribute("data-emoji"))!=null?u:"")}),g.addEventListener("input",()=>{var u;const a=g.value,d=ii(a);if(d!==a){const E=d.length-a.length,m=((u=g.selectionStart)!=null?u:a.length)+E;g.value=d,g.setSelectionRange(m,m)}});function ge(){var a;(a=t.socket)==null||a.disconnect(),t.socket=null,t.sessionId=null,t.sessionClosed=!1,t.messages=[],t.askedForEmail=!1,t.unread=0;try{localStorage.removeItem(ct)}catch(d){}try{localStorage.removeItem(Me)}catch(d){}try{localStorage.removeItem(De)}catch(d){}Se.style.display="none",g.disabled=!1,h.disabled=!1,S.disabled=!1,s!=null&&s.welcomeMessage&&(t.messages.push({id:"welcome",role:"agent",content:s.welcomeMessage,createdAt:new Date().toISOString()}),pe(t.messages)),i()}Ee.addEventListener("click",ge);const N=[],Fe=Date.now();let ye=!1;g.addEventListener("keydown",()=>{ye=!0}),g.addEventListener("input",()=>{ye=!0});function Ce(a){g.value=a,ye=!0,oe.requestSubmit()}o._submitFromChip=Ce;const f=()=>{var E;const a=t.messages.some(m=>m.role==="visitor"),d=/\b(talk|speak|connect|chat)\b.*\b(human|agent|person|representative|support team)\b|\b(human|live agent|real person)\b/i,u=((E=s.welcomeQuickReplies)!=null?E:[]).filter(Boolean).filter(m=>!d.test(m));if(a||u.length===0){re.style.display="none",re.innerHTML="";return}re.style.display="flex",re.innerHTML=u.map((m,T)=>`<button data-i="${T}" type="button">${M(m)}</button>`).join(""),re.querySelectorAll("button").forEach(m=>{m.addEventListener("click",()=>{const T=Number(m.dataset.i),z=u[T];z&&Ce(z)})})};S.addEventListener("click",()=>V.click()),V.addEventListener("change",async()=>{var E;const a=(E=V.files)==null?void 0:E[0];if(V.value="",!a)return;if(a.size>10*1024*1024){Z(o,`File too large: ${a.name} (max 10 MB)`);return}if(N.length>=5){Z(o,"You can attach up to 5 files per message.");return}if(!t.sessionId){Z(o,"Send a message first, then attach files.");return}const d=a.type.startsWith("image/")?URL.createObjectURL(a):void 0,u={id:"pending-"+Date.now(),mimeType:a.type,sizeBytes:a.size,originalFilename:a.name,url:"",localUrl:d};N.push(u),v();try{const m=await H(e,t.sessionId,a),T=N.indexOf(u);T>=0&&(N[T]=xe(ce({},m),{localUrl:d})),v()}catch(m){const T=N.indexOf(u);T>=0&&N.splice(T,1),d&&URL.revokeObjectURL(d),Z(o,`Upload failed: ${m.message}`),v()}});function v(){if(!N.length){W.style.display="none",W.innerHTML="";return}W.style.display="flex",W.innerHTML=N.map((a,d)=>{var B;const u=a.id.startsWith("pending-"),E=(B=a.localUrl)!=null?B:"",T=a.mimeType.startsWith("image/")&&E?`<img class="lc-chip-thumb" src="${M(E)}" alt="">`:"",z=u?`${T}<span class="lc-chip-label lc-chip-uploading">Uploading…</span><span class="lc-spinner"></span>`:`${T}<span class="lc-chip-label">${M(a.originalFilename)}</span><button data-i="${d}" aria-label="Remove">×</button>`;return`<span class="lc-chip${u?" lc-chip--busy":""}">${z}</span>`}).join(""),W.querySelectorAll("button[data-i]").forEach(a=>{a.addEventListener("click",()=>{const d=Number(a.dataset.i),u=N.splice(d,1)[0];u!=null&&u.localUrl&&URL.revokeObjectURL(u.localUrl),v()})})}let L=null,K=!1;const Y=a=>{var d;K!==a&&(K=a,(d=t.socket)==null||d.emit("livechat:typing",{on:a}))};g.addEventListener("input",()=>{g.style.height="auto",g.style.height=Math.min(120,g.scrollHeight)+"px",g.value.trim()?(Y(!0),L&&clearTimeout(L),L=setTimeout(()=>Y(!1),1500)):Y(!1)}),g.addEventListener("blur",()=>Y(!1)),g.addEventListener("keydown",a=>{a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),oe.requestSubmit())}),g.addEventListener("paste",async a=>{var E;const d=(E=a.clipboardData)==null?void 0:E.items;if(!d)return;const u=[];for(const m of d)if(m.kind==="file"&&m.type.startsWith("image/")){const T=m.getAsFile();T&&u.push(T)}if(u.length){if(a.preventDefault(),!t.sessionId){Z(o,"Send a message first, then paste images.");return}for(const m of u){if(m.size>10*1024*1024){Z(o,`Pasted image too large: ${m.name||"image"} (max 10 MB)`);continue}if(N.length>=5)break;const T=m.name?m:new File([m],`pasted-${Date.now()}.png`,{type:m.type}),z=URL.createObjectURL(T),B={id:"pending-"+Math.random().toString(36).slice(2),mimeType:m.type,sizeBytes:m.size,originalFilename:T.name,url:"",localUrl:z};N.push(B),v();try{const J=await H(e,t.sessionId,T),w=N.indexOf(B);w>=0&&(N[w]=xe(ce({},J),{localUrl:z})),v()}catch(J){const w=N.indexOf(B);w>=0&&N.splice(w,1),URL.revokeObjectURL(z),Z(o,`Upload failed: ${J.message}`),v()}}}}),oe.addEventListener("submit",async a=>{var T,z,B,J;if(a.preventDefault(),he.value)return;if(t.sessionClosed){Z(o,"This conversation has ended. Start a new chat below.");return}const d=g.value.trim(),u=(T=/[^\s,;'"<>]+@[^\s,;'"<>]+\.[^\s,;'"<>]{2,}/.exec(d))==null?void 0:T[0];if(u){let w=!1;try{const I=localStorage.getItem(fe);w=I==="saved"||!!I&&I!=="skipped"}catch(I){}w||Promise.resolve().then(()=>rn).then(I=>I.identify(e,{email:u})).then(()=>{var U,ae,nn;try{localStorage.setItem(fe,"saved"),localStorage.setItem(De,"saved")}catch(ns){}const I=o.querySelector(".lc-gate-email");I&&(I.value=u);const O=o.querySelector('.lc-inline-identify[data-step="email"] .lc-inline-input');O&&(O.value=u,(nn=(ae=(U=O.closest)==null?void 0:U.call(O,"form"))==null?void 0:ae.requestSubmit)==null||nn.call(ae))}).catch(()=>{})}const E=N.some(w=>w.id.startsWith("pending-")),m=N.filter(w=>w.url&&!w.id.startsWith("pending-"));if(E){Z(o,"Your image is still uploading — please wait a moment.");return}if(!(!d&&!m.length)){if(!xi()){Z(o,"Slow down — too many messages in the last minute.");return}if(s.requireEmail){let w=!1;try{const I=localStorage.getItem(fe);w=I==="saved"||!!I&&I!=="skipped"}catch(I){}if(!w&&t.messages.some(O=>O.role==="visitor")){Z(o,"Please enter your email to continue.");const O=o.querySelector('.lc-inline-identify[data-step="email"] .lc-inline-input');O&&O.focus();return}}h.disabled=!0,g.value="",g.style.height="auto",Y(!1),yi(t,d,m),N.length=0,v(),f(),i(),zt(o);try{const w=await mt(e,d,m.map(I=>I.id),{hp:he.value||void 0,elapsedMs:Date.now()-Fe,hadInteraction:ye},(B=(z=t.collectPageContext)==null?void 0:z.call(t))!=null?B:{});if(ke(o),t.sessionId=w.sessionId,wi(w.sessionId),"content"in w.agent&&w.agent.content){const I=(J=w.agent.id)!=null?J:"";if(!t.socket)dt(t,w.agent.content,I);else{const O=w.agent.content;setTimeout(()=>{t.messages.some(ae=>ae.id===I)||!!t.activeDraftId||(dt(t,O,I),i())},250)}}if(t.socket||Dt(e,t,i,s),s.requireEmail){let I=!1;try{const O=localStorage.getItem(fe);I=O==="saved"||!!O&&O!=="skipped"}catch(O){}I||t.messages.some(U=>U.id==="identify-email"||U.id==="identify-email-done")||(t.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),i())}else mi(o,t,i)}catch(w){ke(o),Z(o,"Could not send — please try again.")}h.disabled=!1,i()}});const C=o.querySelector(".lc-messages");return C.addEventListener("click",async a=>{var m,T;const d=a.target,u=d.closest(".lc-inline-skip");if(u){const z=u.getAttribute("data-step");if(z==="name")try{localStorage.setItem(je,"skipped")}catch(B){}else if(z==="email")try{localStorage.setItem(fe,"skipped")}catch(B){}t.messages=t.messages.filter(B=>B.id!==`identify-${z}`),i();return}const E=d.closest(".lc-inline-save");if(E){const z=E.getAttribute("data-step"),B=E.closest(".lc-inline-identify"),J=B==null?void 0:B.querySelector("input"),w=(T=(m=J==null?void 0:J.value)==null?void 0:m.trim())!=null?T:"";if(z==="name"){if(!w)return;try{await Ke(e,{name:w}),t.knownName=w;try{localStorage.setItem(je,w)}catch(O){}const I=t.messages.findIndex(O=>O.id==="identify-name");I>=0&&(t.messages[I]={id:"identify-name-done",role:"system",content:`Nice to meet you, ${w}!`,createdAt:new Date().toISOString()}),i()}catch(I){}}else if(z==="email"){const I=O=>{var ae;J==null||J.classList.add("lc-inline-input--invalid");let U=B==null?void 0:B.querySelector(".lc-inline-error");!U&&B&&(U=document.createElement("div"),U.className="lc-inline-error",(ae=B.querySelector(".lc-inline-row"))==null||ae.after(U)),U&&(U.textContent=O)};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w)){I("That doesn't look right — double-check?");return}if(await ri(w)){I("Please use a permanent email — we can’t follow up on temporary inboxes.");return}try{await Ke(e,{email:w});try{localStorage.setItem(fe,"saved")}catch(U){}try{localStorage.setItem(De,"saved")}catch(U){}const O=t.messages.findIndex(U=>U.id==="identify-email");O>=0&&(t.messages[O]={id:"identify-email-done",role:"system",content:`Great — we'll reach out at ${w} if we miss you here.`,createdAt:new Date().toISOString()}),i()}catch(O){}}}}),C.addEventListener("keydown",a=>{const d=a;if(d.key!=="Enter")return;const u=d.target;if(!u.matches(".lc-inline-identify input"))return;d.preventDefault();const E=u.closest(".lc-inline-identify"),m=E==null?void 0:E.querySelector(".lc-inline-save");m==null||m.click()}),f(),o}function lt(n){if(!n.open||!n.socket)return;n._seenIds||(n._seenIds=new Set);const e=n.messages.filter(t=>(t.role==="agent"||t.role==="operator")&&!n._seenIds.has(t.id)).map(t=>t.id);e.length&&(e.forEach(t=>n._seenIds.add(t)),n.socket.emit("livechat:messages_seen",{messageIds:e}))}function Dt(n,e,t,i){!e.sessionId||e.socket||(e.socket=ei(n,e.sessionId,s=>{var r,c,l,y,x,A,k,$,te,ne,p,_,q,D,R,j,oe,g,he;if(s.type==="typing"){const h=e.panel;if(!h)return;s.on?zt(h):ke(h);return}if(s.type==="session_status"&&s.status==="closed"){(r=e.socket)==null||r.disconnect(),e.socket=null,e.sessionClosed=!0;const h=e.panel;if(h){const S=h.querySelector(".lc-session-end"),V=h.querySelector("textarea"),W=h.querySelector('.lc-composer button[type="submit"]'),re=h.querySelector(".lc-attach-btn");S&&(S.style.display="flex"),V&&(V.disabled=!0),W&&(W.disabled=!0),re&&(re.disabled=!0),e.feedbackAsked||(e.feedbackAsked=!0,e.messages.push({id:`feedback-${Date.now()}`,role:"system",content:"__feedback__",createdAt:new Date().toISOString()}))}t();return}if(s.type==="session_status"&&(s.status==="needs_human"||s.status==="human_taken_over"||s.status==="open")){const h=e.panel,S=h==null?void 0:h.querySelector(".lc-queue-banner");S&&(s.status==="needs_human"?(S.style.display="flex",(c=e.startQueuePolling)==null||c.call(e)):(S.style.display="none",(l=e.stopQueuePolling)==null||l.call(e)));return}if(s.type==="agent_stream_start"&&s.draftId){const h=e.panel;h&&ke(h),e.messages.some(S=>S.id===s.draftId)||(e.activeDraftId=s.draftId,e.messages.push({id:s.draftId,role:"agent",content:"",createdAt:(y=s.createdAt)!=null?y:new Date().toISOString()}),t());return}if(s.type==="agent_stream_delta"&&s.draftId&&s.delta){const h=e.messages.findIndex(S=>S.id===s.draftId);if(h>=0){e.messages[h]=xe(ce({},e.messages[h]),{content:e.messages[h].content+s.delta});const S=e.panel,V=S==null?void 0:S.querySelector(".lc-msg--streaming");if(V){V.textContent=e.messages[h].content;const W=S==null?void 0:S.querySelector(".lc-messages");W&&(W.scrollTop=W.scrollHeight)}else t()}return}if(s.type==="agent_stream_end"&&s.draftId&&s.messageId){e.activeDraftId=null;const h=e.messages.findIndex(S=>S.id===s.draftId);if(e.messages.some(S=>S.id===s.messageId)){h>=0&&(e.messages.splice(h,1),pe(e.messages),t());return}h>=0&&(e.messages[h]=xe(ce({},e.messages[h]),{id:s.messageId,content:(x=s.content)!=null?x:e.messages[h].content}),pe(e.messages),e.open?lt(e):(e.unread=((A=e.unread)!=null?A:0)+1,Ut(),($=e.showMsgPreview)==null||$.call(e,(k=s.content)!=null?k:e.messages[h].content)),t());return}if(s.type==="agent_suggestions"&&s.messageId&&((te=s.suggestions)!=null&&te.length)){const h=e.messages.findIndex(S=>S.id===s.messageId);h>=0&&(e.messages[h]=xe(ce({},e.messages[h]),{suggestions:s.suggestions.slice(0,3)}),t());return}if(s.type!=="message"||!s.messageId||s.role==="visitor"||e.messages.some(h=>h.id===s.messageId))return;if(e.activeDraftId){const h=e.messages.findIndex(S=>S.id===e.activeDraftId);h>=0&&e.messages.splice(h,1),e.activeDraftId=null}if(s.role==="system")bi(e,(ne=s.content)!=null?ne:"",s.messageId);else{const h=(p=s.operatorName)!=null?p:void 0,S=(R=s.operatorAvatarUrl)!=null?R:h&&(D=(q=(_=i==null?void 0:i.operators)==null?void 0:_.find(V=>V.name===h))==null?void 0:q.avatarUrl)!=null?D:void 0;dt(e,(j=s.content)!=null?j:"",s.messageId,s.role==="operator",s.attachments,h,S)}const o=e.panel;o&&ke(o),e.open?lt(e):(e.unread=((oe=e.unread)!=null?oe:0)+1,Ut(),(he=e.showMsgPreview)==null||he.call(e,(g=s.content)!=null?g:"")),t()}))}function fi(n,e){const t=n.querySelector(".lc-messages");if(!t)return;if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}const i=(()=>{for(let s=e.messages.length-1;s>=0;s--){const o=e.messages[s];if(o.role==="agent"||o.role==="operator")return s;if(o.role==="visitor")return-1}return-1})();t.innerHTML=e.messages.map((s,o)=>{var ne,p;if(s.content==="__identify_name__"||s.content==="__identify_email__"){const _=s.content==="__identify_name__",q=_?"name":"email",D=!_&&e.knownName?`<span class="lc-inline-greet">Thanks ${M(e.knownName)}! </span>`:"",R=_?"Mind if I get your name?":`${D}If we miss you here, what's the best email to follow up on?`,j=_?"Your name":"you@example.com",oe=_?"text":"email",g=_?"given-name":"email";return`<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-ai">${Kt()}</div>
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-agent lc-inline-identify" data-step="${q}">
              <div class="lc-inline-prompt">${R}</div>
              <div class="lc-inline-row">
                <input type="${oe}" class="lc-inline-input" placeholder="${j}" autocomplete="${g}" />
                <button type="button" class="lc-inline-save" data-step="${q}" aria-label="Save">${Vt()}</button>
              </div>
              ${_||!e.requireEmail?`<button type="button" class="lc-inline-skip" data-step="${q}">${_?"Skip":"Maybe later"}</button>`:""}
            </div>
          </div>
        </div>`}const r=s.content?s.role==="visitor"?Ti(s.content):Ii(s.content):"",c=((ne=s.attachments)!=null?ne:[]).map(Ei).join(""),l=c?`<div class="lc-attachments">${c}</div>`:"",y=Ci(s.createdAt),x=y?`<div class="lc-msg-time">${y}</div>`:"",A=o===i&&s.suggestions&&s.suggestions.length?`<div class="lc-chips">${s.suggestions.map(_=>`<button class="lc-chip" data-chip="${G(_)}">${M(_)}</button>`).join("")}</div>`:"";if(s.role==="system")return s.content==="__feedback__"?`<div class="lc-msg lc-msg-system lc-feedback" data-feedback-id="${G(s.id)}">
            <span>How was this chat?</span>
            <button class="lc-fb-btn" data-rating="up" aria-label="Good">👍</button>
            <button class="lc-fb-btn" data-rating="down" aria-label="Bad">👎</button>
          </div>`:`<div class="lc-msg lc-msg-system">${r}</div>`;if(s.role==="visitor")return`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${r}${l}</div>
            ${x}
          </div>
        </div>`;const k=s.id&&s.id!=="welcome"?`<div class="lc-msg-rating" data-msg-id="${G(s.id)}">
            <button class="lc-rate-btn" data-rating="up" aria-label="Helpful">&#128077;</button>
            <button class="lc-rate-btn" data-rating="down" aria-label="Not helpful">&#128078;</button>
           </div>`:"";if(s.role==="operator"){const _=(p=s.operatorName)!=null?p:"Operator";return`<div class="lc-msg-row lc-msg-row-agent">
          ${s.operatorAvatarUrl?`<img class="lc-msg-avatar lc-msg-avatar-img" src="${G(s.operatorAvatarUrl)}" alt="${M(_)}" title="${M(_)}">`:`<div class="lc-msg-avatar lc-msg-avatar-op" title="${M(_)}">${M(pt(_))}</div>`}
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${M(_)}</div>
            <div class="lc-msg lc-msg-agent">${r}${l}</div>
            ${x}
            ${A}
          </div>
        </div>`}const $=s.id===e.activeDraftId,te=$?" lc-msg--streaming":"";return`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar lc-msg-avatar-ai">${Kt()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent${te}">${$?M(s.content):r}${l}</div>
          ${x}
          ${A}
          ${k}
        </div>
      </div>`}).join(""),t.querySelectorAll(".lc-msg-rating").forEach(s=>{s.querySelectorAll(".lc-rate-btn").forEach(o=>{o.addEventListener("click",async()=>{var x,A,k;const r=o.getAttribute("data-rating"),c=(x=s.getAttribute("data-msg-id"))!=null?x:"",l=(k=(A=n._state)==null?void 0:A.sessionId)!=null?k:"",y=n._cfg;if(!(!c||!l||!y)){s.querySelectorAll(".lc-rate-btn").forEach($=>$.disabled=!0),o.classList.add("lc-rate-btn--active");try{await fetch(`${y.apiBase}/livechat/session/${encodeURIComponent(l)}/message/${encodeURIComponent(c)}/rating`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:y.siteKey,visitorId:y.visitorId,rating:r}),credentials:"omit"})}catch($){}}})})}),t.querySelectorAll(".lc-chip").forEach(s=>{s.addEventListener("click",()=>{var c;const o=(c=s.getAttribute("data-chip"))!=null?c:"";if(!o)return;const r=n._submitFromChip;if(r)r(o);else{const l=n.querySelector("textarea"),y=n.querySelector(".lc-composer");if(!l||!y)return;l.value=o,l.dispatchEvent(new Event("input",{bubbles:!0})),y.requestSubmit()}})}),t.querySelectorAll(".lc-fb-btn").forEach(s=>{s.addEventListener("click",async()=>{const o=s.closest(".lc-feedback"),r=s.getAttribute("data-rating");if(!o||!r)return;const c=e.sessionId,l=e.cfg;if(c&&l)try{await fetch(`${l.apiBase}/livechat/session/${encodeURIComponent(c)}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:l.siteKey,visitorId:l.visitorId,rating:r}),credentials:"omit"})}catch(y){}o.innerHTML="<span>Thanks for the feedback!</span>"})}),jt(n)}function jt(n){const e=n.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function zt(n){const e=n.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function ke(n){n.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function mi(n,e,t){let i=!1;try{i=!!localStorage.getItem(De)}catch(k){}const s=e.messages,o=s.filter(k=>k.role==="visitor").length,r=s.filter(k=>k.role==="agent").length;let c=null;try{c=localStorage.getItem(je)}catch(k){}const l=!!c||!!e.knownName||i,y=s.some(k=>k.id==="identify-name"||k.id==="identify-name-done");!l&&!y&&r>=1&&(e.askedForName=!0,e.messages.push({id:"identify-name",role:"agent",content:"__identify_name__",createdAt:new Date().toISOString()}),t());let x=!1;try{x=!!localStorage.getItem(fe)}catch(k){}const A=s.some(k=>k.id==="identify-email"||k.id==="identify-email-done");!x&&!i&&!A&&o>=pi&&(e.askedForEmail=!0,e.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),t())}function gi(){try{const n=localStorage.getItem(je);return!n||n==="saved"||n==="skipped"?null:n}catch(n){return null}}function yi(n,e,t){n.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),pe(n.messages)}function dt(n,e,t,i=!1,s,o,r){n.messages.push({id:t||"srv-"+Date.now(),role:i?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:s,operatorName:o,operatorAvatarUrl:r}),pe(n.messages)}function bi(n,e,t){n.messages.push({id:t||"sys-"+Date.now(),role:"system",content:e,createdAt:new Date().toISOString()}),pe(n.messages)}function xi(){var n;try{const e=Date.now(),t=JSON.parse((n=localStorage.getItem(Mt))!=null?n:"[]").filter(i=>e-i<di);return t.length>=li?!1:(t.push(e),localStorage.setItem(Mt,JSON.stringify(t)),!0)}catch(e){return!0}}function vi(){try{return localStorage.getItem(ct)}catch(n){return null}}function wi(n){try{localStorage.setItem(ct,n)}catch(e){}}function ki(n,e){if(e)try{localStorage.getItem(`${Pt}_${n}`)!==e&&(localStorage.removeItem(Me),localStorage.setItem(`${Pt}_${n}`,e))}catch(t){}}function _i(){try{const n=localStorage.getItem(Me);return n?JSON.parse(n):[]}catch(n){return[]}}function pe(n){try{localStorage.setItem(Me,JSON.stringify(n.slice(-50)))}catch(e){}}function Ut(){try{const n=new(window.AudioContext||window.webkitAudioContext),e=n.createOscillator(),t=n.createGain();e.connect(t),t.connect(n.destination),e.type="sine",e.frequency.setValueAtTime(880,n.currentTime),e.frequency.setValueAtTime(1100,n.currentTime+.08),t.gain.setValueAtTime(.12,n.currentTime),t.gain.exponentialRampToValueAtTime(.001,n.currentTime+.35),e.start(n.currentTime),e.stop(n.currentTime+.35)}catch(n){}}function M(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function Si(n){if(!n)return null;const e=n.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function Ht(n,e){let t=n.replace("#","");t.length===3&&(t=t.split("").map(r=>r+r).join(""));const i=parseInt(t.slice(0,2),16),s=parseInt(t.slice(2,4),16),o=parseInt(t.slice(4,6),16);return`rgba(${i}, ${s}, ${o}, ${e})`}function Ei(n){if(n.mimeType.startsWith("image/")&&n.url)return`<a href="${G(n.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${G(n.url)}" alt="${G(n.originalFilename)}" /></a>`;const t=Ai(n.sizeBytes);return`<a class="lc-attach-file" href="${n.url?G(n.url):"#"}" target="_blank" rel="noopener noreferrer">${Li()}<span>${M(n.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function Ti(n){return M(n).replace(/(https?:\/\/[^\s<]+)/g,i=>{const s=i.match(/[.,;:!?)]+$/),o=s?s[0]:"",r=o?i.slice(0,-o.length):i;return`<a href="${G(r)}" target="_blank" rel="noopener noreferrer nofollow">${r}</a>${o}`}).replace(/\n/g,"<br>")}function Ii(n){let e=M(n);const t=[];return e=e.replace(/`([^`\n]+)`/g,(i,s)=>(t.push(`<code class="lc-md-code">${s}</code>`),`\0C${t.length-1}\0`)),e=e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(i,s,o)=>`<a href="${G(o)}" target="_blank" rel="noopener noreferrer nofollow">${s}</a>`),e=e.replace(/\*\*([^*\n]+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g,"$1<em>$2</em>"),e=e.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g,(i,s,o)=>{const r=o.match(/[.,;:!?)]+$/),c=r?r[0]:"",l=c?o.slice(0,-c.length):o;return`${s}<a href="${G(l)}" target="_blank" rel="noopener noreferrer nofollow">${l}</a>${c}`}),e=e.replace(/ C(\d+) /g,(i,s)=>{var o;return(o=t[Number(s)])!=null?o:""}),e=e.replace(/\n/g,"<br>"),e}function G(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function Ai(n){return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}function Z(n,e,t=3500){const i=n.querySelector(".lc-toast");i&&(i.textContent=e,i.style.display="block",clearTimeout(i._timer),i._timer=setTimeout(()=>{i.style.display="none"},t))}function pt(n){return n.trim().split(/\s+/).map(e=>{var t;return(t=e[0])!=null?t:""}).join("").slice(0,2).toUpperCase()}function Ci(n){try{const e=new Date(n);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function Oi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function Li(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function $i(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function Ri(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function Ft(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function Vt(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}function Bi(){return'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>'}function qi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.36L3 16"/><path d="M3 21v-5h5"/></svg>'}function Ni(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}function Pi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'}function Kt(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>'}function Mi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'}function Di(n,e){return!n.length&&(e!=null&&e.trim())?`<div class="lc-header-avatars"><div class="lc-op-avatar lc-op-initials" style="z-index:3">${M(pt(e.trim()))}</div></div>`:n.length?`<div class="lc-header-avatars">${n.slice(0,3).map((s,o)=>{const r=o===0?"":"margin-left:-10px;",c=`z-index:${3-o};`;return s.avatarUrl?`<img class="lc-op-avatar" src="${G(s.avatarUrl)}" alt="${M(s.name)}" style="${c}${r}">`:`<div class="lc-op-avatar lc-op-initials" style="${c}${r}">${M(pt(s.name))}</div>`}).join("")}</div>`:`<div class="lc-header-avatar">${Ri()}</div>`}let Yt="",_e=null,Ue=null;const ji=3e4;function zi(n){Wt(n),Hi(n),window.addEventListener("popstate",()=>ht(n)),window.addEventListener("pagehide",()=>{_e&&Ve(n,_e)}),Ui(n)}function Ui(n){const e=()=>{document.visibilityState==="visible"&&ft(n,{url:location.href,title:document.title})};setInterval(e,ji),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function Hi(n){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const i=e.pushState.apply(this,t);return ht(n),i},history.replaceState=function(...t){const i=e.replaceState.apply(this,t);return ht(n),i}}function ht(n){Ue&&clearTimeout(Ue),Ue=setTimeout(()=>Wt(n),300)}async function Wt(n){var t;Ue=null;const e=location.pathname+location.search;if(e!==Yt){Yt=e,_e&&Ve(n,_e);try{_e=(t=(await ut(n,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(i){}}}const Jt="livechat_visitor_id";function Fi(){const n=Vi();if(!n)return null;const e=n.getAttribute("data-site");if(!e)return null;const t=n.getAttribute("data-api")||Ki(n)||"",i=Yi();let s;try{const $=n.getAttribute("data-context");$&&(s=JSON.parse($))}catch($){}try{const $=window.CortexLivechat;$!=null&&$.context&&typeof $.context=="object"&&(s=ce(ce({},s),$.context))}catch($){}const o=n.getAttribute("data-popup"),r=o===null?!0:o!=="false"&&o!=="0",c=n.getAttribute("data-open"),l=c==="true"||c==="1",y=n.getAttribute("data-delay"),x=y!==null&&/^\d+$/.test(y)?parseInt(y,10):1500,A=(n.getAttribute("data-position")||"").trim().toLowerCase();return{siteKey:e,visitorId:i,apiBase:t,context:s,popup:r,autoOpen:l,popupDelay:x,position:A==="left"||A==="bottom-left"?"bottom-left":A==="right"||A==="bottom-right"?"bottom-right":void 0}}function Vi(){const n=document.querySelectorAll("script[data-site]");return n.length?n[n.length-1]:null}function Ki(n){if(!n.src)return null;try{const e=new URL(n.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function Yi(){try{const n=localStorage.getItem(Jt);if(n)return n;const e=Qt();return localStorage.setItem(Jt,e),e}catch(n){return Qt()}}function Qt(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let n=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(n+Math.random()*16)%16|0;return n=Math.floor(n/16),(e==="x"?t:t&3|8).toString(16)})}const Xt="livechat_build",Wi=["livechat_messages_cache","livechat_session_id","livechat_identify_dismissed","livechat_send_log","livechat_proactive_seen"];function Ji(){try{localStorage.getItem(Xt)!=="mrjkw3gz"&&(Wi.forEach(n=>localStorage.removeItem(n)),localStorage.setItem(Xt,"mrjkw3gz"))}catch(n){}}(function(){var i;if(typeof window=="undefined"||(i=window.__livechat__)!=null&&i.mounted)return;Ji();const e=Fi();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},zi(e);const t=async()=>{const s=await Q(e);hi(e,s!=null?s:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
