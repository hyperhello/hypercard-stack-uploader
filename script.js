/* (c) 2022 Hypervariety Custom Software. All rights reserved. Packaged 2023-01-01 07:25:36 */ 

/* 
	
	LICENSE:
	This file was developed ©2022 Hypervariety Custom Software, LLC. There is no warranty of any kind expressed or implied.
	THIS FILE IS OPEN SOURCE. YOU CAN COPY AND RUN THIS FILE YOURSELF AND LEARN PROGRAMMING TECHNIQUES FROM IT.
	Although the code is not very well-written or pretty, in the interests of public discourse, I am making it available for view. 
	
	THANK YOU TO THE RETRO-HACKERS WHO FIGURED OUT THE HC STACK FORMAT.
	
	This script accompanies the stack importer at https://github.com/hyperhello/hypercard-stack-uploader
	
*/
"use strict";

/*
Custom elements included in this package:
<marching-ants></marching-ants>
Attributes: inset=0,visible

<xtalk-common-template></xtalk-common-template>
Attributes: name='',script=''

<stack-part></stack-part> inherits from xtalk-common-template
Attributes: width=512,height=342,tool=Browse,visualEffect='',importedICONs,importedICONResources,importedWAVs,importedPLTEs,importedPICTs,importedCURSs,importedColorData,buttonCSSFont,fieldCSSFont

<card-or-background-template></card-or-background-template> inherits from xtalk-common-template
Attributes: color,ID=0,dontSearch=false,cantDelete=false,showPict=true,bitmap,addColorData=''

<card-part></card-part> inherits from card-or-background-template
Attributes: marked=false,bkgndID=0

<background-part></background-part> inherits from card-or-background-template

<button-or-field-template></button-or-field-template> inherits from xtalk-common-template
Attributes: id,visible=true,topLeft,width,height,textHeight,textAlign='',textFont='',textSize='',textStyle='plain',color='',bevel=0

<field-part></field-part> inherits from button-or-field-template
Attributes: type,scroll=0,lockText=false,dontWrap=false,autoSelect=false,sharedText=false,multipleLines=false,wideMargins=true,fixedLineHeight=false,showLines=false

<button-part></button-part> inherits from button-or-field-template
Attributes: type=transparent,hilite|highlight|highlite|hilight=false,autoHilite=true,sharedHilite=true,family='',showName=true,enabled=true,icon=0,selectedLine=0

<title-bar-menu></title-bar-menu>
Attributes: name,show=false

<title-bar-menuitem></title-bar-menuitem>
Attributes: contents,markChar,menuMessage|menuMsg

<modal-dialog></modal-dialog>
Attributes: name,visible,x,y

<card-window-delegate></card-window-delegate>
Attributes: scroll,rectangle|rect,width,height

<packaged-answer-and-ask-boxes></packaged-answer-and-ask-boxes>

<color-bevel-picker></color-bevel-picker>
Attributes: hasColor,color='#FFFFFF',bevel=0,showBevel

*/


/* (c) 2022 Hypervariety Custom Software. All rights reserved. */
"use strict";

/* you can sort of mix and match xtalk and javascript */
function number(n)
{
if (typeof n === 'number') return n;
if (typeof n !== 'boolean') {
var nn = Number(n);
if (!isNaN(nn)) return nn;
}
throw Error("Expected a number here but found " + tickedString(n));
}
function boolean(n)
{
if (n===true || n===false) return n;
if (typeof n==='string') {
if (n.toLowerCase()==='true') return true;
if (n.toLowerCase()==='false') return false;
}
throw Error("Expected a true or false here but found " + tickedString(n));
}
function point(value)
{
if ((value=String(value).split(',').map((v)=>number(v))) && value.length==2)
return value;
throw Error("Expected a point here but found " + tickedString(value));
}
function rectangle(value)
{
if ((value=String(value).split(',').map((v)=>number(v))) && value.length==4)
return value;
throw Error("Expected a rectangle here but found " + tickedString(value));
}


function tickedString(str) { return "`" + String(str).replaceAll("\\","\\\\").replaceAll("`","\\`").replaceAll("${","$\\{") + "`"; }

/* call new XTalk(me, script).
it will create a script tag either in me.shadowRoot or document.head, and attach itself as me.xTalk. */

class XTalk
{
constructor(me, script = "", options = {})
{
if (options.debug) debugger;

// since document.currentScript is not available in shadow roots, we're going to do a simple thing with a unique ID
var xtalk = this, xtalk_id = (
{ '#document':'doc', 'BUTTON-PART':'btn','FIELD-PART':'fld','CARD-PART':'cd','BACKGROUND-PART':'bg','STACK-PART':'stack'}[me.nodeName]||me.nodeName).replaceAll(/[- ]/g,'_')
+ '_$' + (++XTalk.UniqueID).toString(16).toUpperCase();

var handlers = [], handler = null, lineinfo = [], indent = 0, embed = [], stripembeds = true;

script.split('\n').forEach((line, index, array)=>{
var contmatch;
while (contmatch=/¬[\s]*(--(.*))?$/gi.exec(line)) {
// for each contination concatenate the next line and go again
index++;
line = line.substr(0, line.length - contmatch[0].length) + ' ' + (array[index] || '');
array[index] = '';
//console.log(line);
}
transpile_line(line, index);
});

function handlername(handler, withDollars)
{ return (withDollars ? '$$$' : '') + handler.type + '_' + handler.name + (withDollars ? '$$$' : ''); }

var coroutines = `"use strict"; XTalk.InitCoroutinesFor('` + xtalk_id + "', function " + xtalk_id + '(me) {\n';
handlers.forEach((h)=>{ h.jLine = coroutines.split('\n').length; coroutines += h.coroutine + '\n'; });
coroutines += '\nreturn { '
+ 'handlers: { ' + handlers.filter((h)=>h.type=='on').map((h)=>h.name + ':' + handlername(h,true)).join(', ') + ' }, '
+ 'functions: { ' + handlers.filter((h)=>h.type.toLowerCase()=='function').map((h)=>h.name + ':' + handlername(h,true)).join(', ') + ' } '
+ ' };'
+ '\n});';

this.raw = { handlers, lineinfo };

this.scriptTag = document.createElement('script');
this.scriptTag.id = xtalk_id;
this.scriptTag.text = coroutines;
this.me = me;
this.text = coroutines;
this.treat_as_accessory = options.treat_as_accessory;
this.options = options || {};

if (!options.treat_as_accessory)
{
if (me.xTalk)
me.xTalk.remove();
me.xTalk = this;
}

XTalk.UninitedXTalks[xtalk_id] = this;
try {
((!options.treat_as_accessory && me.shadowRoot) || document.head).appendChild(this.scriptTag);
} catch(e) {
console.log(e, coroutines, this.scriptTag);
}

XTalk.warned_this_time = false;

function transpile_line(line, index)
{
var example = { count: 0 };
XTalk.Examples = (XTalk.Examples || {});
if (!options.lineRule)	// don't save example in the message box or anywhere with different parsing rule
example = XTalk.Examples[line] = (XTalk.Examples[line] || example);

var error = null, match = /^[\s]*(on|function|end)[\s]+([A-Z0-9_]+)[\s]*((([A-Z0-9_]+)[\s]*[,]?[\s]*)*)[\s]*/giy.exec(line);
if (match && (match[1].toLowerCase()=='on' || match[1].toLowerCase()=='function'))
{
if (handler)
error = ("Unended handler " + handler.name);	// maybe should be on previous line

if (handlers.find((h)=>(h.type==match[1] && h.name==match[2])))
error = "Duplicate handler or function name";
handler = { type: match[1].toLowerCase(), name: match[2], line: index, params: (match[3] || ''), code: [], script: [] };
lineinfo.push({ indent: 0, error });
indent = 1;
embed = [];
}
else if (!handler)
{
lineinfo.push({ indent: 0, error: line.trim() && (line.trim().substr(0,2)!='--') && "Ignored statement outside of handler" });
}
else if (match && (match[1].toLowerCase()=='end') && (handler.name.toLowerCase()==match[2].toLowerCase()))
{
commit_handler();
handler = null;
lineinfo.push({ indent: 0, error });
}
else
{
XTalk.CurrentHandler = handler.name;
var o = '', cluematch = null, error = null, fallback = null;
if (example.count)
o = example.js;	// very much faster but only good if [and it is] scriptline -> javascript is totally consistent.
else if (line.trim())
o = XTalk.Translate(options.lineRule || 'handler-line', line)
delete XTalk.CurrentHandler;

if (example.count && example.js != o)	// for testing, can't trigger if the above is in place
console.log('example was different', example, o);
example.js = o;
example.count++;

if (o === undefined) {
//debugger;
//error = ("Can't understand this.");
o = '';//handler.type + ' ' + handler.name + ' line ' + (handler.code.length+1) + ': ' + line;
if (options.fallbackToJS && line)
o = fallback = line;
else if (line.trim())
error = "Can't understand ‘" + line.trim() + "’";
//error = "throw 'Cant understand ' + " + tickedString(line) + ";";
}

if (!o.trim())	// all comment or empty
{}

lineinfo.push({ indent, error });
if (error && !options.dontComplain)
console.log((me && me.closest && me.closest('stack-part') && (me.closest('stack-part').name+': ') || '')+ error + ' in ' + handler.name);

if (o !== undefined && (cluematch=/(\{)?[\s]*(\/\*([=]?[A-Za-z]+[=?]?)\*\/)?$/g.exec(o.trim())))
{

if (cluematch[1])
indent++;
}

if (error)
o = "throw Error(" + tickedString(error) + ");";

handler.script.push(fallback ? '' : line);
handler.code.push(o);
}
}

function commit_handler()
{
var flowResult = performFlowAnalysis(handler.code);
flowResult.indent.forEach((depth,i)=>lineinfo[handler.line+1+i].indent = depth+1);
//	if (flowResult.indent.find((i)=>i!=0)) debugger;

var param_json = handler.params.split(',').map((p,i)=>{
return (p=p.trim()) ? "'"+p.toLowerCase()+"':"+/*p*/i+"<arguments.length?arguments["+i+"]:''" : '';
}).join(',');

var uniqueHandlerID = ++XTalk.UniqueHandlerID;
XTalk.DebugLocMap[uniqueHandlerID] = handler;

// still stumbling on where to put the yields exactly. if we redid the ifs to always use braces that would work.
// should reallllyy figure out that cool inline-comment trick. make a unit test!
// scriptLine should be the thing that yields I guess.
handler.me = me;
handler.xtalk = xtalk;
handler.errorProc = options.errorProc;
handler.coroutine = 'function*' + handlername(handler,true) + '(' + (options.fallbackToJS ? handler.params : '') + ') {'
+ 'const ' + (options.useGlobalVariables ? '_=XTalk.Globals' : '_=new XTalk.EchoProxy({'+param_json+'})') + ';'
+ 'try { \n'
+ handler.script.map((s,i)=>{
if (!handler.code[i].trim())
return "// " + s.trim() + "\n//\n";
var isclosebrace = ((/[\s]*[\}]/y).exec(handler.code[i]) || (/[\s]*else /y).exec(handler.code[i]) || [''])[0].length;
var openbrace = ((/[\s]*(else )?[\{]/y).exec(handler.code[i]) || [''])[0].length;
return "// " + " ".repeat(lineinfo[i].indent) + s.trim()
+ '\n'
+ " ".repeat(lineinfo[i].indent) + handler.code[i].substr(0,openbrace) + ((isclosebrace||options.dontYield) ? "" : "yield(" + ((uniqueHandlerID << 16) + i+1) + "); ") + handler.code[i].substr(openbrace)
+ '\n';
}).join('')
+ flowResult.autoclose
+ ' return "";'
+ '} catch(e) {((e=e instanceof Error?e:new Error(e))._=e._||[]).push({_,$:this,id:'+uniqueHandlerID+'});throw e;}'
+ '}\n';	// this causes Firefox's built in linter to bug out when preceded with 'exit handler' script line

try {
// I thought this was an acid test. But Function("()=>yield*1") didn't trigger.
Function(handler.coroutine);
if (!XTalk.warned_this_time && XTalk.warned_last_time)
console.log('Mutated script');
XTalk.warned_last_time = false;
}
catch(e) {
//console.log(handler.coroutine);
XTalk.warned_last_time = XTalk.warned_this_time = true;
if (body.classList.contains('javascript'))
console.log(me.longName + ' ' + (me.owner) + ' ' + handler.name + ' line ' + e.line + ' ' + e, handler.script, handler.coroutine, handler);
else
console.log(me.longName + ' ' + (me.owner) + ' ' + handler.name + ' line ' + e.line + ' ' + e, handler.coroutine.split('\n')[e.line*2-1], handler.coroutine);

handler.coroutine = 'function*' + handlername(handler,true) + '(' + ') { }\n';
}

handlers.push(handler);
}

function performFlowAnalysis(coroutine)
{
// given array of JS, strip the double-comments, find indent
var flowstack = [], result = { indent: [], errors: [], autoclose: '' };

for (var i = 0; i < coroutine.length; i++)
{
var line = coroutine[i], depth = flowstack.filter((fsf)=>fsf[1]=='?!').length;

if (line.trim().length)
{
var reg = /(\/\*([^\*]*)\*\/)([^\/]*?)(\/\*([^\*]*)\*\/)/g, match, matches = [], charadjust = 0;

while (match=reg.exec(line))
matches.push([match[2],match[3],match[5],match.index,reg.lastIndex]);
if (matches.length==0) {
autoclose = adjuststack('', '', true, false, i);
//if (autoclose) line = autoclose + ' ' + line;
if (autoclose) coroutine[i-1] += autoclose;
}
else for (var m = 0; m < matches.length; m++)
{
var autoclose = adjuststack(matches[m][0].trim(), matches[m][1], (m==0), i);
//if (autoclose) { line = autoclose + ' ' + line; charadjust -= autoclose.length; }
if (autoclose) coroutine[i-1] += autoclose;
if (m==0) depth = flowstack.filter((fsf)=>fsf[1]=='?!').length;
autoclose = adjuststack(matches[m][2].trim(), matches[m][1], false, i);

line = line.substr(0,matches[m][3]-charadjust) + matches[m][1] + line.substr(matches[m][4]-charadjust);
charadjust += (matches[m][4]-matches[m][3]) - matches[m][1].length;
}
}

result.indent.push(depth);
coroutine[i] = line;
}

while (flowstack.length && flowstack[flowstack.length-1][1]=='?')
result.autoclose += flowstack.pop()[2];

if (flowstack.length)	// this is a script error
result.errors.push(['leftover flowstack', flowstack]);

// this would mean a problem with the flow analysis (or means there's a brace in a quoted string)
var lb = 0, rb = 0, county = (coroutine.join('\n') + result.autoclose).split('').map((c)=>{ if (c=='{') lb++; else if (c=='}') rb++; });
if (lb!=rb)
console.warn(coroutine.join('\n'), lb + ' left braces, ' + rb + ' right braces' + (lb==rb ? '....good' : '  WARNING '));

return result;

function adjuststack(command, sourcetext, linestart, lineindex)
{
var prefix = '', suffix = '', autoclose = '', inner = command;

if (inner[0]=='+' || inner[0]=='-')
{ prefix = inner[0]; inner = inner.substr(1); }
if (inner.substr(-1)=='!')
{ suffix = '!'; inner = inner.substr(0,inner.length-1); }
if (inner.substr(-1)=='?')
{ suffix = '?'+suffix; inner = inner.substr(0,inner.length-1); }
if (inner.substr(-1)=='}')
{ autoclose = '}'; inner = inner.substr(0,inner.length-1); log('found autoclose'); }

//console.log([prefix, inner, suffix, command, sourcetext]);
var didRemove, top = flowstack[flowstack.length-1], executed_autoclose = '';

function log() { if (false) console.log(...arguments); }

if (prefix == '-') {
if (top && top[0].split(',').includes(inner)) {
flowstack.pop();
//executed_autoclose += top[2];
top = flowstack[flowstack.length-1];
didRemove = inner;
log('executed ' + command, flowstack);
}
else {
// don't complain yet
//console.warn('cannot execute ' + command, flowstack);
}
}

if (linestart) {
if (top && top[1]=='?') {
if (/*top[0]!=*/!didRemove) {
flowstack.pop();
executed_autoclose += top[2];
log('forgot ' + top, flowstack);
top = flowstack[flowstack.length-1];
}
}
else if (top && top[1]=='?!') {
log('allowed ' + top, flowstack);
}
else if (top) {
result.errors.push({ line: lineindex, error: 'unsatisfied ' + top });
console.warn('unsatisfied ' + top, flowstack);
}
}

if (prefix == '-' && !didRemove) {
if (top && top[0].split(',').includes(inner)) {
flowstack.pop();
//executed_autoclose += top[2];
top = flowstack[flowstack.length-1];
didRemove = true;
log('executed ' + command, flowstack);
}
else {
// this time complain
result.errors.push({ line: lineindex, error: 'cannot execute ' + command });
console.warn('cannot execute ' + command, flowstack);
}
}

if (prefix == '+') {
flowstack.push([inner,suffix,autoclose]);
log('executed ' + command, flowstack);
}
else if (prefix == '@') {
if (!flowstack.find((fsf)=>fsf[0].split(',').includes(inner))) {
result.errors.push({ line: lineindex, error: 'inappropriate ' + top });
log('inappropriate ' + top, flowstack);
}
else
log('allowed ' + top, flowstack);
}

if (executed_autoclose) log('returning autoclose ' + executed_autoclose);
return executed_autoclose;
}
}
}

remove()
{
// what if a script sets its own script while it's running!??!!
if (this.scriptTag && this.scriptTag.parentNode)
{ this.scriptTag.parentNode.removeChild(this.scriptTag); this.scriptTag = null; }
}
stackOf(me, nullOK)
{
// this would work, hopefully
if (XTalkQueue.Active && XTalkQueue.Active.Stack)
return XTalkQueue.Active.Stack;

if (!me) me = this.me;
if (me && me.closest)
me = me.closest('background-part') || me;
return (me && (me.clone_of||me).closest && (me.clone_of||me).closest('stack-part')) || (!nullOK && sim.stack) || undefined;
}
selectOf(selector,byID,numberOrName,container,nullIsOK)
{
return XTalk.SelectOf(selector,byID,numberOrName,container,nullIsOK);
}
parentOf(me)
{
return XTalk.ParentOf(me || this.me);
}
}

class XTalkQueue
{
constructor()
{
this.queue = [];
this.interval = null;
}
stateChange(inprocess)
{
if (this.stateChangeWatcher)
this.stateChangeWatcher(inprocess);
}
push(message, target, params = [], callback, options = {})
{
// pushed tasks don't use the dynamic message queue
this.queue.push({ message, target, params, callback, options });
if (this.queue.length == 1)
{ this.stateChange(true); this.start(); }
}
start()
{
const iRun = this.run(), intervalProc = ()=>{

XTalkQueue.Active = this;
var next = iRun.next();
XTalkQueue.Active = null;

if (!next.done)
{
if (next.value === 0)
return;
this.resume = ()=>{
clearInterval(this.interval);
delete this.resume;
this.interval = setInterval(intervalProc, 0);
//intervalProc();	// without this we'd be delaying that much plus one additional 0. let's see the performance situation first
};
clearInterval(this.interval);
if (next.value < 2**31)	// this is the most you can have in an interval so longer means forever (for answer dialogs etc)
this.interval = setInterval(this.resume, next.value);
}
else
{
// done!
clearInterval(this.interval);
this.interval = null;
}
};

this.interval = setInterval(intervalProc, 0);
}
stopAll(withError)
{

if (this.queue.length)
{
this.queue = [];
clearInterval(this.interval);
this.interval = null;
this.stateChange(false);
}

if (withError && this.queue[0] && this.queue[0].iterator)
{
var inner_error;
try { this.queue[0].iterator.throw(withError); } catch(e) { inner_error = e; }
this.debug(this.queue[0].debugloc, inner_error);
return;
}
}
debug(debugloc, error)
{
var debuggedhandler = XTalk.DebugLocMap[debugloc >> 16];
console.warn(error);	// it would be nice to show local variables and stuff here...
if (!debuggedhandler)
return;
if (body.classList.contains('javascript'))
console.log(debuggedhandler);
if (debuggedhandler.errorProc)
debuggedhandler.errorProc(debuggedhandler.line + 1 + (debugloc & 0xFFFF), error);
else if (XTalk.DebugScriptErrors)
launch_scripteditor(debuggedhandler.xtalk.me, debuggedhandler.line + 1 + (debugloc & 0xFFFF), error);

/*if (false && XTalk.DebugScriptErrors)
{
// this would be a step by step debugger. Just need a 'play' button and for the editor to go away afterwards
var debuggedhandler = XTalk.DebugLocMap[debugloc >> 16];
if (debuggedhandler && debuggedhandler.script[(debugloc & 0xFFFF)-1])
launch_scripteditor(debuggedhandler.xtalk.me, debuggedhandler.line + 1 + (debugloc & 0xFFFF));
}*/
}

*run()
{
var task, handler, iterator;

/*if (!target.xTalk.init)
{
// weird, but we'll do it
console.log(Object.keys(XTalk.UninitedXTalks).length + ' xTalks waiting to init, delaying run 10ms');
yield (10);
}*/

_findNextTask: while (task=this.queue[0])
{
// find the next task to work on
if (task.options.alternate_XTalk)
{
// task with a provided handler
if (!(handler=task.options.alternate_XTalk.handlers[task.message]))
throw "alternate_XTalk has no handler for " + task.message;
}
else
{
var target = task.options.sendToCurrentCard ? sim.stackOf(target).card : task.target;
while ( !target.xTalk && (target=XTalk.ParentOf(target)))
{ }
if (!target || !(handler=target.xTalk.handlers[task.message]))
{
// it went all the way through the normal hierarchy and wasn't caught at all
if (task.callback)
(task.callback)(task.options.successToNotCatch);

this.queue.shift();
continue _findNextTask;
}
}

// task and handler are ready. xtalk handlers yield an integer debug location or a timeout request, or just return their value
const iterator = task.iterator = handler(task.params);
var next, debugloc;

this.Target = task.target;

try
{
var ms_per_slice = 5, dnt = Date.now() + ms_per_slice;	// the yield for events is very costly

run_loop: while (true)
{
for (var n=30; n!==0; n--)	// to avoid time checking as much
{
next = iterator.next();

if (!next.done && typeof next.value === 'number')
debugloc = next.value;
else if (next.done)
break run_loop;
else if (typeof next.value.timeout === 'number')
yield next.value.timeout;
else
debugger;
}
if (dnt <= Date.now())
{
task.debugloc = debugloc;
yield 0;
dnt = Date.now() + ms_per_slice;
}
}

task.debugloc = debugloc;
}
catch (error)
{
task.debugloc = debugloc;

var debuggedhandler = XTalk.DebugLocMap[debugloc >> 16];
if (debuggedhandler)
error.scriptline = debuggedhandler.line + 1 + (debugloc & 0xFFFF);

if (error === XTalk.exitToHyperCard)
next = { done: true, value: '' };
else
{
if (task.callback)
(task.callback)(false, error);

this.debug(debugloc, error);
this.stopAll();
this.stateChange(false);
return;
}
}

if (task.callback)
(task.callback)(true, next.value);
this.queue.shift();
}

// goodbye
this.stateChange(false);
}
}

XTalk.NoSuch = function(msg) { this.msg = msg; }
XTalk.NoSuch.prototype.toString = function() { return this.msg; }

XTalk.UniqueHandlerID = 1;
XTalk.DebugLocMap = {};		// could make this use weak references?

XTalk.ScriptWasChanged = ()=>{};	// when a script changes or when the script editor hides or shows

XTalk.cu = (what) => { throw new Error("Can't understand ‘"+what+"’"); };
XTalk.exitToHyperCard = new Error("exit to hypercard");

XTalk.UniqueID = 1;
XTalk.UninitedXTalks = {};
XTalk.InitCoroutinesFor = function XTalkInitCoroutinesFor(xtalk_id, coroutines_proc)
{
//console.log(xtalk_id);
const xtalk = XTalk.UninitedXTalks[xtalk_id];
const me = xtalk.me;
if (!me) throw "Unknown xtalk_id " + xtalk_id;
delete XTalk.UninitedXTalks[xtalk_id];

// here's the place to add the dynamic path, which means that if a message has no takers at all in the message path it's in, it gets to try the current card + background (if different).
// for this to be valid in HC, the message has to start in a card, button, or field, be uncaught at all, and the go command has to have been in *that* handler.
// we'll just make sure the message is uncaught, originates in a card, button, or field, and <--- is not the current.

const MessagePath = (list, ofFunctions) => {
list = Object.fromEntries(Object.entries(list).map((e)=>[e[0].toLowerCase(), e[1].bind(xtalk)]));
xtalk.raw[ofFunctions ? 'fList' : 'hList'] = list;
return new Proxy(list, {
get(target,property) {
var result = Reflect.get(target, property);
if (result !== undefined)
return result;

if (typeof property==='string' && property.toLowerCase() !== property)	// look for lower case version? have to see if it works oppositely
result = Reflect.get(target, property.toLowerCase());
if (result===undefined) {
var search = xtalk.treat_as_accessory ? me : XTalk.ParentOf(me);
while (search) {
if (search.xTalk && (result=(ofFunctions ? search.xTalk.raw.fList[property.toLowerCase()] : search.xTalk.raw.hList[property.toLowerCase()])))
break;
search = XTalk.ParentOf(search);
}
if (!search) {
// 'me' is not accurate here because the first element in the chain with an xTalk is the one XTalkQueue calls to.
// And anyway we're catching built in messages in the simulator script now.
//console.log('no messagepath result for '+property+' via '+(xtalk.treat_as_accessory ? 'accessory' : me.longName));
if (!xtalk.treat_as_accessory /*&& ['BUTTON-PART','FIELD-PART','CARD-PART','BACKGROUND-PART'].includes(me.nodeName)*/)
{
//console.log('handler ' + property + ' requested in ' + me.longName + ' could go through dynamic msg path');
// don't need to check if the card or background changed because it wasn't caught the first time anyway
var stack = sim.stackOf(me);
if (!((search=stack.card).xTalk && (result=search.xTalk.raw[ofFunctions?'fList':'hList'][property.toLowerCase()])))
(search=stack.background).xTalk && (result=search.xTalk.raw[ofFunctions?'fList':'hList'][property.toLowerCase()]);
if (result)
console.log((ofFunctions?'function ':'on ') + property + ' was found in ' + search.longName + ' via the dynamic path');
// great, you got it working. one issue: a card button, if sent after 'go', would try its own card first as expected. but a bkgnd button, if sent after 'go', would simply try the stack's current card. A message to a background part needs to somehow know what 'card' it is travelling through. Do we add the current card to XTalkQueue.Active to pick in XTalk.ParentOf? This is the same mechanism that 'send to bg btn of card' would use.
}
}
}
return result;
},
has(target,property) {
return Reflect.has(target, (typeof property==='string') ? property.toLowerCase() : property);
}
});
}

xtalk.init = (coroutines_proc)(me);
//xtalk.pathFactory = xtalk_message_path_iterator_factory(me);
xtalk.handlers = MessagePath(xtalk.init.handlers, false);
xtalk.functions = MessagePath(xtalk.init.functions, true);
//console.log(me.xTalk);
}

XTalk.Send = function Send(target, message, params = [], callback = null, successToNotCatch = true, sendToCurrentCard = false)
{
var stack = sim.stackOf(target);
(stack ? stack.queue() : new XTalkQueue()).push(message, target, params, callback, { successToNotCatch, sendToCurrentCard });
}

XTalk.Do = function Send(scriptLines, target, callback = null)
{
if (!target) target = sim.card;
var do_xtalk = new XTalk(target, 'on do_coroutine\n' + scriptLines + '\n\nend do_coroutine', { treat_as_accessory: true });
(do_xtalk.stackOf() ? do_xtalk.stackOf().queue() : new XTalkQueue()).push('do_coroutine', target, [], callback, { alternate_XTalk: do_xtalk });
}

XTalk.SendCoroutine = function*SendCoroutine(parent_, script, target)
{
// send string to target
var do_xtalk = new XTalk(target, 'on send\n' + script + '\nreturn the result\nend send', { treat_as_accessory: true });
var result = yield*do_xtalk.handlers.send(parent_);		// HC uses local variables
return result;
}

function*xtalk_do_coroutine(self, _, expression)
{
var f = new ((function*(){}).constructor)( '_', XTalk.Translate('scriptLine', expression) );
yield*(f.bind(self))(_ || new XTalk.EchoProxy({}));
}
function*xtalk_value_coroutine(self, _, expression)
{
var f = new ((function*(){}).constructor)( '_', 'return '+XTalk.Translate('expressionEndOfScriptLine', expression) );
var result = yield*(f.bind(self))(_);
return (result!==undefined) ? result : expression;
}
function*xtalk_send_coroutine(message,params,target)
{
while (!target.xTalk) {
if (!(target=XTalk.ParentOf(target)))
return;
}
return yield*(target.xTalk.handlers[message]||XTalk.cu(message)).apply(null, params);
}
function*xtalk_pass_coroutine(message,params,target)
{
do {
if (!(target=XTalk.ParentOf(target)))
return;
} while (!target.xTalk);
return yield*(target.xTalk.handlers[message]||XTalk.cu(message)).apply(null, params);
}

XTalk.ParentOf = function parentOf(me)
{
// messages from both card and background buttons and fields go to the card, then background, then stack, then document.
// it might be a little cleaner to have xtalk-common-template expose a .nextInPath property.
if (me.matches)
{
var layer = me.matches('card-part');
if (layer)
return me.background || sim.stackOf(me);

if (me.matches('background-part'))
return sim.stackOf(me);

// simulator supports having a containing field be in the message path.
layer = me.parentNode && me.parentNode.closest('background-part, card-part, field-part');
if (layer)
{
// this is a little tricky; a background part's ParentOf is the card, not the background. The Card's ParentOf is the background.
if (layer.nodeName == 'BACKGROUND-PART' && layer.card_for_bkgnd_clone)
return layer.card_for_bkgnd_clone ;
return layer;
}
}
return me.parentNode && ((me.parentNode.closest && me.parentNode.closest('stack-part,background-part,card-part,button-part,field-part')) || document);
}
XTalk.SelectOf = function selectOf(selector,by,numberOrName,container,allowToBeNull=false)
{
function selectorAndAttribute(aName, aValue) {
var add = '['+aName+'="' + String(aValue).replaceAll('"',"\\22").replaceAll(/[\x00-\x1F]/g,' ') + '" i]';
if (typeof selector === 'string')
return selector+add;
return selector.map((s)=>s+add).join(',');
}

try {
if (container.nodeName==='BACKGROUND-PART' && selector.includes('card-part')) {
selector = selector.replace('card-part','card-part[bkgndID="'+container.ID+'"]');
container = XTalk.ParentOf(container);
}

var candidates, part, n;

if (by==='ordinal') {
candidates = (container.qsa(selector));

// there's another function specifically for cards that supports back, forward, next, etc
if (numberOrName==='last')
return candidates[candidates.length-1];
if (numberOrName==='middle')
return candidates[Math.floor(candidates.length/2)];
if (numberOrName==='any')
return candidates[Math.floor(Math.random()*candidates.length)];

if (numberOrName==='number')	// special one for 'the number of '
return candidates.length;

// otherwise it was really a number like 2
n = number(numberOrName);
part = candidates[n-1];
}
else if (by==='number') {
n = number(numberOrName);
part = (candidates = (container.qsa(selector)))[n-1];
}
else if (by==='id') {
n = number(numberOrName);
//part = (candidates = Array.from(container.qsa(selector))).find((f,i)=>(f.id==n));
part = container.qs(selectorAndAttribute('id',n));
}
else if (by!=='name' && numberOrName != "" && !isNaN(numberOrName) && Number.isInteger(n=Number(numberOrName))) {
// if it's not specifically <string> or <number> (even parenthesis), HC searches by index if it looks like a number
// this makes btn "0" difficult to access. button "99.9" is also button 99.90. Etc
part = (candidates = (container.qsa(selector)))[n-1];
}
else {
part = container.qs(selectorAndAttribute('name', numberOrName));
/*n = String(numberOrName);
part = (candidates = Array.from(container.qsa(selector))).find((f)=>n.localeCompare(f.name,undefined,{sensitivity: 'base' })===0);*/
}
if (part) return part;
} catch (e) {
if (e instanceof XTalk.NoSuch) throw e.msg;
throw e;
}
if (!allowToBeNull)
throw new XTalk.NoSuch('No such ' + selector + (by ? ' '+by : '') + ' ' + numberOrName);
return null;
}
XTalk.CardOf = function cardOf(stack, ordinal, marked, bkgnd)
{
try {
var card = stack.cardOf(ordinal, marked, bkgnd);
if (card) return card;
} catch (e) {
if (e instanceof XTalk.NoSuch) throw e.msg;
throw e;
}
throw new XTalk.NoSuch('No such ' + ordinal + (marked ? ' marked' : '') + ' card' + (bkgnd ? ' of '+bkgnd.longName : ''));
}
XTalk.BackgroundOf = function backgroundOf(stack, ordinal)
{
try {
var bkgnd = stack.backgroundOf(ordinal);
if (bkgnd) return bkgnd;
} catch (e) {
if (e instanceof XTalk.NoSuch) throw e.msg;
throw e;
}
throw new XTalk.NoSuch('No such ' + ordinal + ' bkgnd');
}

/*
_.SomeThing == "SomeThing";
_.sOmethinG == "sOmethinG";
_.someTHING = "now it is something ELSE!";
_.SOMEthing == "now it is something ELSE!";
*/
XTalk.EchoProxyDefaults = {
comma: ',', 'return': '\n', linefeed: '\r', formfeed: '\f', space: ' ', empty: '', quote: '"', colon: ':', tab: '\t',
the_result: undefined, "true": true, "false": false,
zero: 0, one: 1, two: 2, three: 3, pi: Math.PI, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};
XTalk.EchoProxy = function EchoProxy(init)
{
init.$global = {};	// list of global variables
init.$values = (filterFunc)=>Object.entries(init)
.filter((e)=>e[0][0]!='$')
.filter(filterFunc || (()=>true))
.map((e)=>(e[0]=='the_result' ? 'the result' : e[0])+' is ' + (typeof e[1] == 'number' || typeof e[1] == 'boolean' ? e[1] : '"'+String(e[1]).replaceAll("\n","↵")+'"'))
.join(', ');
init.$value = (v)=>init[v];

Object.setPrototypeOf(init, XTalk.EchoProxyDefaults);

var proxy = new Proxy(init, {
get: (target,property) => {
//console.log('getting ' + property);
if (typeof property === 'string' && Object.keys(target.$global).find((g)=>g.toLowerCase()===property.toLowerCase())
&& proxy !== XTalk.Globals)
{ //console.log('get global hit ' + property);
return (property in XTalk.Globals) ? XTalk.Globals[property] : "";
}
var result = Reflect.get(target, (typeof property === 'string') ? property.toLowerCase() : property);
return (result!==undefined || (init.$return_result_as_undefined && property==='the_result')) ? result : (property==='the_result') ? '' : property;
},
set: (target,property,value) => {
//console.log('setting ' + property);
if (typeof property === 'string' && Object.keys(target.$global).find((g)=>g.toLowerCase()==property.toLowerCase())
&& proxy !== XTalk.Globals)
{ //console.log('set global hit ' + property);
target = XTalk.Globals;
}
//console.log(target,property,value);
Reflect.set(target, (typeof property === 'string') ? property.toLowerCase() : property, value);
return true;
},
has: (target,property) => {
return Reflect.has(target, (typeof property === 'string') ? property.toLowerCase() : property);
}
});
return proxy;
}

XTalk.GlobalsBasisObject = { $return_result_as_undefined: true, issimulator: true };
XTalk.Globals = new XTalk.EchoProxy(XTalk.GlobalsBasisObject);

XTalk.Rules = { };

XTalk.Support = function(type, grammar, output, options)
{
//console.log({type, grammar, output});

if (!type) {
// special handle <rule> | <rule2> = .....
var input = tree(grammar,false,'=');
var names = (input[1] === '=' && typeof input[0] == 'object' && input[0].choice)
|| (input[1] === '=' && [[input[0]]]) || [['illegal']];
input.shift(); input.shift();
names.forEach((n)=>{
if (n.length != 1 || typeof n[0] != 'object' || !n[0].rule) {
if (!(/^[\s]*#/.test(grammar)))
throw "can't understand grammar "+grammar;
else
return;
}
XTalk.Support(n[0].rule, input, output, Object.assign({ supplied_grammar: grammar },options));
});
return;
}
var feature = XTalk.Rules[type] || (XTalk.Rules[type]=[]),
variation = {
input: (grammar instanceof RegExp)
? [ { regexp: new RegExp(grammar, grammar.flags.replace(/y|$/,'y')) } ]
: (typeof grammar === 'object') ? grammar : tree(grammar),
output: output ? tree(output,true) : null,
prefixed_by_choice: (typeof grammar=='string') && /^[\s]*[\|]/g.test(grammar),
options,
supplied_grammar: grammar,
supplied_output: output
};
feature.push(variation);

function tree(rule,as_output,choice_breaking_string)
{
// grammar format is <rulereference> | [ | ] | ]* | ]+ | ]! | whatever
// [zero or one], [zero or more]*, [one]!, [one or more]+. Really need to add { }
// much better would be to support [] and {} input, and not even use them for output.
var tokenexp, match;

if (as_output)
tokenexp = /([\s]*)(<([A-Za-z0-9]+)>|([^\s\S])|([^\s\S])|([\|][\|]|[^\<\|\s]+|[^\|])|([\|]))/gy, match;
else
tokenexp = /([\s]*)(<([A-Za-z0-9]+)>|([\[\{])|(\]\*|\]\+|\]\-|\]|\}\*|\}\+|\})|([\|][\|]|[^\[\]\{\}\<\|\s]+|[^\|])|([\|]))/gy, match;
//var tokenexp = /([\s]*)(<([A-Za-z0-9]+)>|([\[\{])|(\]\*|\]\+|\]\!|\]|\}\*|\}\+|\})|([^\[\]\{\}\<\|\s]+|[^\|])|([\|]))/gy, match;
return subtree(rule);
function subtree(rule, bracket)
{
var out = [], choices = [];
while (match=tokenexp.exec(rule))
{
//console.log(match);
var last_is_string = (out.length && typeof out[out.length-1]==='string');
if (as_output && last_is_string)
out[out.length-1] += match[1];

if (match[3]) {
var ticked = (rule.substr(Math.max(0,match.index-1),2)=="`<" && rule.substr(tokenexp.lastIndex-1,2)==">`");
/*if (ticked) console.log('ticked!', rule);
else console.log(ticked, rule.substr(Math.max(0,match.index-1),2), rule.substr(tokenexp.lastIndex-1,2), rule);*/
out.push({ rule: match[3], ticked });
}
else if (match[4]) {
var sub = { inner: subtree(rule,match[4][0]==='['?']':'}') };
function last(array)
{ return array.length && typeof array[array.length-1] == 'object' && array[array.length-1]; }
if (last(sub.inner) && last(sub.inner).endrepeat)
sub.repeat = sub.inner.pop().endrepeat;
else if (last(sub.inner) && last(sub.inner).choice
&& last(last(sub.inner).choice) && last(last(last(sub.inner).choice)) && last(last(last(sub.inner).choice)).endrepeat)
sub.repeat = last(last(sub.inner).choice).pop().endrepeat;
out.push(sub);
}
else if (match[5]) {
if (!bracket || bracket !== match[5][0])
throw('unexpected '+match[5]+' bracket');
bracket = false;
if (match[5] == ']*') out.push({ endrepeat: '*' });		// * is zero or more
else if (match[5] == ']+' || match[5] == '}*') out.push({ endrepeat: '+' });	// + is one or more
else if (match[5] == '}') out.push({ endrepeat: '!' });		// ! is one
else if (match[5] == ']-') out.push({ endrepeat: '-' });	// - is zero
break;
}
else if (match[6]) {
if (match[6]===choice_breaking_string && choices.length) {
choices.push(out);
out = [{ choice: choices }];
choices = [];
}
if (last_is_string && (as_output || !match[1].length))
out[out.length-1] += match[6];
else
out.push(((as_output && match[1]) || '')+String(match[6]));
}
else if (match[7]) {
if (out.length)
choices.push(out);
out = [];
}
}
if (bracket)
throw('expected '+bracket+' bracket');
return choices.length ? [{ choice: choices.concat([out]) }] : out;
}
}
}

XTalk.Translate = function(rule, text)
{
text = String(text);
//XTalk.log('parsing <' + rule + '> with text:', text);
var Packrat = {}, LR = {}, i = 0, result = translate(rule, XTalk.Rules[rule]);
if (result)
return result.join('');
return undefined;

function translate(rule, rules_list)
{
if (!rules_list) throw "unknown rule reference " + rule;

var packrat_key = (rule + '@' + i), packrat_object = Packrat[packrat_key];

if (packrat_object)
{
if (!packrat_object.growth)
{ packrat_object.enabled = true; return; }
i = packrat_object.growI;
return packrat_object.growth;
}

function successor_choice(typeI) {
do {
typeI++;
} while (typeI < rules_list.length && rules_list[typeI].prefixed_by_choice);
return typeI;
}
// starting to work. the +1 needs to be fixed up
var was_in_LR = LR[rule];
delete LR[rule];	// we are not currently in growth
packrat_object = (Packrat[packrat_key]={ enabled: false, growI: null, growth: null });

var startI = i, match_type_index, result = undefined, first_match_type_allowed = was_in_LR ? successor_choice(was_in_LR.type) : 0;
for (match_type_index = first_match_type_allowed; match_type_index < rules_list.length; match_type_index++)
if (result=translate_type(rules_list[match_type_index]))
break;

if (result) {
packrat_object.growI = i;
packrat_object.growth = result;
}
if (result && packrat_object.enabled)
{
//console.log('starting growth at ' + startI + ' previous growth status is', was_in_LR);

//console.log(rule, match_type_index);
do
{
LR[rule] = { type: first_match_type_allowed };
packrat_object.growI = i;
packrat_object.growth = result;
i = startI;
result = undefined;
for (var grow_match_type_index = first_match_type_allowed; grow_match_type_index < rules_list.length; grow_match_type_index++) {
LR[rule] = { type: grow_match_type_index };
if (result=translate_type(rules_list[grow_match_type_index])) {
//console.log('started growth at ' + startI + ' new status is', LR[rule]);
break;
}
}
}
while (result !== undefined && i > packrat_object.growI);
i = packrat_object.growI;
result = packrat_object.growth;
}

LR[rule] = was_in_LR;
return result;

function translate_type(type)
{
var matches = [], out = [], terminal;

if (type.options && type.options.preflight && !type.options.preflight(text,i,Packrat))
return undefined;

function ensurepostsuccess(text, i, Packrat, out)
{
return !type.options || !type.options.postflight ||type.options.postflight(text,i,Packrat);
}

var success = parse_pieces(type.input, false, ensurepostsuccess);

if (success && type.output)
{
var production = [];
//XTalk.log(type.output);
type.output.forEach((o)=>{
if (typeof o === 'string')
production.push(o);
else if (o.rule) {
var m = matches.findIndex((m)=>(m.rule==o.rule && !m.used));
if (m == -1)
m = matches.findIndex((m)=>(m.rule==o.rule));
if (m == -1) {
production.push('<..' + o.rule + '..>');
console.log('missing input rule ' + o.rule);
}
else {
production = production.concat(matches[m].out);
matches[m].used = true;
}
}
else { console.log(o); throw "unknown output type "; }
});
out = production;
}

// these aren't reversing the i.... problem!!
if (success && type.options && type.options.postproduce && !type.options.postproduce(out))
success = false;

/*if (type.options && type.options.postflight && !type.options.postflight(text,i,Packrat))
success = false;*/

if (!success)
return undefined;

return out;

function parse_pieces(pieces, disallow_null, ensurepostsuccess)
{
var startI = i, startOL = out.length, startML = matches.length;
if (!pieces.find(piece_failure)
&& !(disallow_null && (startI==i))
&& (!ensurepostsuccess || ensurepostsuccess(text, i, Packrat, out)))
return out;
i = startI;
out.splice(startOL);
matches.splice(startML);
return undefined;

var terminal,result;
function piece_failure(p)
{
while (/[^\S\n]/.test(text[i])) { i++; }

if (typeof p === 'string') {
if (p.toLowerCase()==(terminal=text.substr(i,p.length)).toLowerCase()
&& !(/[A-Z0-9_]/i.test(p[p.length-1]) && /[A-Z0-9_]/i.test(text[i+p.length]||''))) {
out.push(terminal);
i += p.length;
return false;
}
}
else if (p.regexp) {
/*p.regexp.lastIndex = i;
var rm = p.regexp.exec(text);*/
p.regexp.lastIndex = 0;
var rm = p.regexp.exec(text.substr(i));	// identifier has a thing not to match the...it's inconvenient
if (rm) {
out.push(terminal=text.substr(i,rm[0].length));
i += rm[0].length;
return false;
}
}
else if (p.rule) {
if (result=translate(p.rule, XTalk.Rules[p.rule])) {
matches.push({ rule: p.rule, out: result });
out = out.concat(result);
return false;
}
}
else if (p.inner)
{ 	// [optional], [required]!, [at least zero]*, [at least one]+, [not any]-
var any = false;
while (parse_pieces(p.inner, !(p.repeat=='-')))
{ any = true; if (p.repeat != '*' && p.repeat != '+') break; }
if (p.repeat=='-')
return any;
if (!(!any && (p.repeat=='+' || p.repeat=='!') ) )
return false;
}
else if (p.choice)
{
if (p.choice.find((p)=>parse_pieces(p)))
return false;
}
else throw "unknown input type " + p;
return true;
}
}
}
}
}

XTalk.ImportGrammar = function(rulename, rulestring, options)	// enhance this a bit to support more than one grammar type, etc
{
var ge = rulestring.split('\n');
for (var i = 0; i < ge.length-1; i++)
if (/=>[\s]*$/.test(ge[i]) || /^[\s]*=>/.test(ge[i+1]))
ge[i] += ge.splice(i+1,1)[0];
ge = ge.map((g)=>g.split('=>'));
ge.forEach((s)=>{
if (!s[0].trim()) return;
XTalk.Support(rulename, s[0].trim(), s.slice(1).join('=>').trim(), options);
});
}

// I would like to break out a <container> usable for chunks, properties, and the like, supporting into/after/before as chunk pieces, for put, set, add, subtract, delete, etc,
// that returns a get/set proxy object or something. For simple sets of variables and properties with no chunk, transpile directly.

// issue with: go card targ of bg "People"
// if I interpret as <card> , fine
// but if I go card 1 + 1 I need to go to card 2, that's the syntax. but card (targ of bg "People") works as an expression...
// I need go to <card> [endofline]-

XTalk.ImportGrammar('',`
<endOfScriptLine> = [ [ <linefeed> | else ]- ]-
`);

XTalk.ImportGrammar('statement', `

answer <expression>	with <factor> {or|,} <factor> {or|,} <factor>		=>	(yield*this.handlers.answer(_, <expression>, <factor>, <factor>, <factor>));
answer <expression>	with <factor> {or|,} <factor>					=>	(yield*this.handlers.answer(_, <expression>, <factor>, <factor>, ''));
answer <expression>	with <factor> 							=>	(yield*this.handlers.answer(_, <expression>, <factor>, ''));
answer <expression>	 										=>	(yield*this.handlers.answer(_, <expression>));
answer 				 										=>	(yield*this.handlers.answer(_, ''));

ask <expression> with <expression>							=>	(yield*this.handlers.ask(_, <expression>, <expression>));
ask <expression> 											=>	(yield*this.handlers.ask(_, <expression>, ''));
ask 			 											=>	(yield*this.handlers.ask(_, '', ''));

get <expression> [into it]									=>	_.it = <expression>;
#
go [to] [the] [stack] {home|"home"} [stack]							=>	goHome();
go [to] [the] [stack] {help|"help"} [stack]							=>	(yield*this.handlers.help());
| go [to] <card> <endOfScriptLine>			  				=>  (yield*this.stackOf().GoCoroutine(<card>));
| go [to] {card|cd} <idOrEmpty> <expression> <endOfScriptLine> 				=>  (yield*this.stackOf().GoCoroutine(this.selectOf('card-part', <idOrEmpty>, <expression>, this.stackOf())));
| go [to] <background> 										=>	(yield*this.stackOf().GoCoroutine(XTalk.CardOf(this.stackOf(),1,false,<background>)));
| go back													=>	(yield*go_recent_card_coroutine());
| go forth													=>	(yield*go_recent_card_coroutine(true));
| go back													=>	(yield*this.stackOf().GoCoroutine('back'));
| go forth													=>	(yield*this.stackOf().GoCoroutine('forth'));
| go [to] <cardOrdinal> 									=>	(yield*this.stackOf().GoCoroutine(XTalk.CardOf(this.stackOf(),<cardOrdinal>)));
| go [to] <partOrEquiv> <endOfScriptLine>	 					=>	(yield*this.stackOf().GoCoroutine(<partOrEquiv>));
| go [to] [ [<cardOrdinal>|this] {card|cd} [of|in|<idOrEmpty> <identOrExprOf>] ] [stack] [<card>|<background>]- <expression> [in [a|an] new window]	=>  (yield*this.handlers.goToStack(<expression>));
| go [to] [ [<cardOrdinal>|this] {card|cd} [of|in|<idOrEmpty> <identOrExprOf>] ] [stack] [<card>|<background>]- <factorsWithSpaces> [in [a|an] new window]	=>  (yield*this.handlers.goToStack(<factorsWithSpaces>));
#

put <expressionWithCommas> into <chunkList> [the] <property> of <part> | set <chunkList> [the] <property> of <part> to <expressionWithCommas>
=>	((e,cl,p)=>{ var c = String(p.<property>), r = XTalkChunk(cl, c, [], true); p.<property> = [c.substr(0,r[0]),r[2],e,c.substr(r[1])].join(''); })(<expressionWithCommas>,[<chunkList>],<part>);

put <expressionWithCommas> into <chunkList> <partPossessive> <property> <possessiveChunkList> | set <chunkList> <partPossessive> <property> <possessiveChunkList> to <expressionWithCommas> =>	((e,p)=>{ var c = String(p.<property>), r = XTalkChunk(cl, c, [<possessiveChunkList>], true); p.<property> = [c.substr(0,r[0]),r[2],e,c.substr(r[1])].join(''); })(<expressionWithCommas>,[<chunkList>], <partPossessive>);

put <expressionWithCommas> into <chunkList> <partPossessive> <property> | set <chunkList> <partPossessive> <property> to <expressionWithCommas> =>	((e,p)=>{ var c = String(p.<property>), r = XTalkChunk(cl, c, [], true); p.<property> = [c.substr(0,r[0]),r[2],e,c.substr(r[1])].join(''); })(<expressionWithCommas>,[<chunkList>],<partPossessive>);

put <expressionWithCommas> into <chunkList> <partWithContents>	| set <chunkList> <partWithContents> to <expressionWithCommas> =>  ((e,cl,p)=>{ var c = String(p.contents), r = XTalkChunk(cl, c, [], true); p.contents = [c.substr(0,r[0]),r[2],e,c.substr(r[1])].join(''); })(<expressionWithCommas>,[<chunkList>],<partWithContents>);

put <expressionWithCommas> into <chunkList> <variable> | set <chunkList> <variable> to <expressionWithCommas> => ((e,cl)=>{ var c = String(_.<variable>), r = XTalkChunk(cl, c, [], true); _.<variable> = [c.substr(0,r[0]),r[2],e,c.substr(r[1])].join(''); })(<expressionWithCommas>, [<chunkList>]);

set [the] {textFont|textSize|textStyle|textHeight} of <chunkList> <extratext>		=> null;

put <expressionWithCommas> into [the] <property> of <partOrEquiv> | set [the] <property> of <partOrEquiv> to <expressionWithCommas> 	=>	<partOrEquiv>.<property> = <expressionWithCommas>;

put <expressionWithCommas> into <partPossessive> <property> | set <partPossessive> <property> to <expressionWithCommas>	=>	<partPossessive>.<property> = <expressionWithCommas>;

put <expressionWithCommas> into <menu> with {menuMessages|menuMsgs|menuMessage|menuMsg} <expressionWithCommas>	=> ((menu)=>{ menu.contents = <expressionWithCommas>; menu.menuMessages = <expressionWithCommas>; })(<menu>);

put <expressionWithCommas> into [the] { {message|msg} [box|window] }		=>	(yield*this.handlers.put(<expressionWithCommas>));
put <expressionWithCommas> into <partWithContents>			=>	<partWithContents>.contents = <expressionWithCommas>;
put <expressionWithCommas> into <variable> 			 		=>	_.<variable> = <expressionWithCommas>;
[let] <variable> = <expressionWithCommas> 	 			 	=>	_.<variable> = <expressionWithCommas>;

put <expression> before <chunkList> <partWithContents>		=>  ((e,cl,p)=>{ var r = XTalkChunk(cl, p.contents, [], true); p.contents = [p.contents.substr(0,r[0]),r[2],e,p.contents.substr(r[0])].join(''); })(<expression>, [<chunkList>], <partWithContents>);
put <expression> before <chunkList> <variable>				=>  _.<variable> = ((e,r)=>[_.<variable>.substr(0,r[0]),r[2],e,_.<variable>.substr(r[0])].join(''))(<expression>,XTalkChunk([<chunkList>], _.<variable>, [], true));
put <expression> before <partWithContents> 					=>	((e,s)=>s.contents = String(e) + s.contents)(<expression>,<partWithContents>);
put <expression> before <variable> 							=>	_.<variable> = <expression> + _.<variable>;

put <expression> after <chunkList> <part>					=>  ((e,cl,p)=>{ var r = XTalkChunk(cl, p.contents, [], true); p.contents = [p.contents.substr(0,r[1]),r[2],e,p.contents.substr(r[1])].join(''); })(<expression>, [<chunkList>], <part>);
put <expression> after <chunkList> <variable>				=>  _.<variable> = ((e,r)=>[_.<variable>.substr(0,r[1]),r[2],e,_.<variable>.substr(r[1])].join(''))(<expression>, XTalkChunk([<chunkList>], _.<variable>, [], true));
put <expression> after <partWithContents>					=>	<partWithContents>.contents += <expression>;
put <expression> after <variable> 							=>	_.<variable> = _.<variable> + <expression>;

put <expressionWithCommas>									=> (yield*this.handlers.put(<expressionWithCommas>));
set [the] <property> to <expressionWithCommas>				=>	(yield*(sim.handlers.set<property>||XTalk.cu('<property>'))(<expressionWithCommas>));

#

delete <buttonOrField>										=> ((p)=>p.parentNode.removeChild(p))(<buttonOrField>);
delete <chunkList> <partWithContents>
=> ((cl,p)=>{ var pc = p.contents, r = XTalkChunk(cl, pc, [], 'includeTrailing'); p.contents=[pc.substr(0,r[0]),pc.substr(r[1])].join(''); })([<chunkList>],<partWithContents>);
delete <chunkList> <variable>
=>  _.<variable> = ((r)=>[_.<variable>.substr(0,r[0]),_.<variable>.substr(r[1])].join(''))(XTalkChunk([<chunkList>], _.<variable>, [], 'includeTrailing'));
#

<addSubtract> <expression> {to|from} <chunkList> <partWithContents>			=>  ((e,cl,p)=>{ var r = XTalkChunk(cl, p.contents, [], true); p.contents=[p.contents.substr(0,r[0]),r[2],number(p.contents.substring(r[0],r[1])) <addSubtract> number(e),p.contents.substr(r[1])].join(''); })(<expression>,[<chunkList>],<partWithContents>);
<addSubtract> <expression> {to|from} <chunkList> <variable>				=>  ((e,cl)=>{ var p = String(_.<variable>), r = XTalkChunk(cl, p, [], true); _.<variable> = [p.substr(0,r[0]),r[2],number(p.substring(r[0],r[1]))<addSubtract>number(e),p.substr(r[1])].join(''); })(<expression>,[<chunkList>]);
<addSubtract> <expression> {to|from} [the] <property> of <part> 		=>	((e,p)=>p.<property>=number(p.<property>) <addSubtract> number(e))(<expression>,<part>);
<addSubtract> <expression> {to|from} <partWithContents> 					=>	((e,p)=>p.contents=number(p.contents) <addSubtract> number(e))(<expression>,<partWithContents>);
<addSubtract> <expression> {to|from} <variable> 							=>	_.<variable> = number(_.<variable>) <addSubtract> number(<expression>);

<multiplyDivide> <chunkList> <partWithContents> by <expression>			=>  ((e,cl,p)=>{ var r = XTalkChunk(cl, p.contents, [], true); p.contents=[p.contents.substr(0,r[0]),r[2],number(p.contents.substring(r[0],r[1])) <multiplyDivide> number(e),p.contents.substr(r[1])].join(''); })(<expression>,[<chunkList>],<partWithContents>);
<multiplyDivide> <chunkList> <variable>	by <expression>			=>  _.<variable> = ((e,r)=>[_.<variable>.substr(0,r[0]),r[2],number(_.<variable>.substring(r[0],r[1])) <multiplyDivide> number(e),_.<variable>.substr(r[1])].join(''))(<expression>,XTalkChunk([<chunkList>], _.<variable>, [], true));
<multiplyDivide> [the] <property> of <part> by <expression>  		=>	((p,e)=>p.<property>=number(p.<property>) <multiplyDivide> number(e))(<part>,<expression>);
<multiplyDivide> <partWithContents> by <expression>					=>	((p,e)=>p.contents=number(p.contents) <multiplyDivide> number(e))(<partWithContents>,<expression>);
<multiplyDivide> <variable> by <expression>							=>	_.<variable> = number(_.<variable>) <multiplyDivide> number(<expression>);

#
send <expression> to hypercard								=> 	(yield*(XTalk.SendCoroutine(_, <expression>, document)));
send <expression> to <partOrEquiv>							=> 	(yield*(XTalk.SendCoroutine(_, <expression>, <partOrEquiv>)));
send { <message> | "<message>" } <expressionList> to <partOrEquiv>		=> 	yield*xtalk_send_coroutine('<message>', [<expressionList>], <partOrEquiv>);
#send { <message> | "<message>" } to <partOrEquiv>			=> 	yield*xtalk_send_coroutine('<message>', [], <partOrEquiv>);
#send { <message> | "<message>" }							=>  yield*xtalk_send_coroutine('<message>', [], this.me);
{do|send} <expression> <endOfScriptLine>					=>  yield*xtalk_do_coroutine(this, _, <expression>);
do <extratext>												=>  yield*xtalk_do_coroutine(this, _, \`<extratext>\`);

enable <partOrEquiv>										=>	<partOrEquiv>.enabled = true;
disable <partOrEquiv>										=>	<partOrEquiv>.enabled = false;
#
show [the] {message|msg} [box|window]						=>  if (window.messagebox) messagebox_setvisible(true);
hide [the] {message|msg} [box|window]						=>  if (window.messagebox) messagebox_setvisible(false);
{show|hide} [the] {menubar|titlebar|scroll window|tool window|pattern window}						=>  null;
show <partOrEquiv> at <expressionWithCommas>				=>	((p,e)=>{ p.loc = e; p.visible = true; })(<partOrEquiv>,<expressionWithCommas>);
show {picture|pict} {of|in} <card>						=>  <card>.showPict = true;
hide {picture|pict} {of|in} <card>						=>  <card>.showPict = false;
show {card|cd} {picture|pict} 								=>  this.stackOf().card.showPict = true;
hide {card|cd} {picture|pict}								=>  this.stackOf().card.showPict = false;
show {background|bkgnd|bg} {picture|pict} 		=>  this.stackOf().background.showPict = true;
hide {background|bkgnd|bg} {picture|pict}			=>  this.stackOf().background.showPict = false;
show [the] palette											=>  palette.visible=true;
show all [cards|cds]										=> (yield*this.handlers.showCards(''));
show <expression> {cards|cds}								=> (yield*this.handlers.showCards(<expression>));
show <partOrEquiv>											=>	<partOrEquiv>.visible = true;
hide <partOrEquiv>											=>	<partOrEquiv>.visible = false;
#
select text of <buttonOrField>								=>  getSelection().selectAllChildren(<buttonOrField>.contentsContainer());
select {text|after|before} [<extratext>]					=>	null;
select line <identOrExprOf> <buttonOrField>        	  		=>  <buttonOrField>.selectedLine = <identOrExprOf>;
select <buttonOrField>										=>  (yield*this.handlers.select(<buttonOrField>));
play <factor> <factorsWithSpaces>								=>  (yield*this.handlers.play(<factor>, <factorsWithSpaces>));
visual [effect] <factorsWithSpaces>							=>  this.stackOf().visualEffect = <factorsWithSpaces>;
push <card>													=>  this.stackOf().pushCard(<card>);
pop {cd|card} into <variable>								=>  _.<variable> = String(this.stackOf().popCard());
pop {cd|card}												=>  (yield*this.stackOf().GoCoroutine(this.stackOf().popCard()));

mark all {cards|cds}										=> this.stackOf().qsa(':scope > card-part').forEach((c)=>c.marked=true);
mark <card>													=> <card>.marked = true;
unmark all {cards|cds}										=> this.stackOf().qsa(':scope > card-part').forEach((c)=>c.marked=false);
unmark <card>												=> <card>.marked = false;

global <globalList> 										=>  <globalList>;

create menu <factor>											=> this.stackOf().parentNode.getMenu(<factor>,true,true);
delete menu <factor>											=> this.stackOf().parentNode.deleteMenu(<factor>,true);

doMenu <factorsWithSpaces>									=>  (yield*this.handlers.doMenu(<factorsWithSpaces>));
{choose [the] tool <factor> | choose [the] <factor> tool}		=>  (yield*this.handlers.choose(<factor>));
click at <expressionWithCommas>	with <expressionWithCommas>	=>  ((p,m)=>this.stackOf().clickDrag(p[0],p[1],p[0],p[1],m))(point([<expressionWithCommas>].join()),<expressionWithCommas>);
click at <expressionWithCommas>		=>  ((p)=>this.stackOf().clickDrag(p[0],p[1],p[0],p[1]))(point([<expressionWithCommas>].join()));
drag from <expressionWithCommas> to <expressionWithCommas> [with <extratext>]	=>  ((p,s)=>this.stackOf().clickDrag(p[0],p[1],s[0],s[1]))(point([<expressionWithCommas>].join()),point([<expressionWithCommas>].join()));
type <expression> [with <expressionWithCommas>]				=>  document.execCommand('insertText',null,<expression>);
speak <expression> with {voice <expression> | <expression> voice }	=>  (yield*this.handlers.speak(<expression>,<expression>));
speak <expression> 											=>  (yield*this.handlers.speak(<expression>));

{ flash | lock | unlock | dial | close window | convert | create {menuitem} | delete {menuitem} | picture | start using | stop using | sort | reset {menubar|paint}  } [<extratext>]		=>	null;
addColor <expressionList>									=> this.stackOf().refreshAddColorStage();
palette <expression>, <expression>							=> _.the_result = create_palette(JSON.parse(this.stackOf().importedPLTEs||'{}')[<expression>], point(<expression>));
palette <expression>										=> _.the_result = create_palette(JSON.parse(this.stackOf().importedPLTEs||'{}')[<expression>]);

edit [the] script of <partOrEquiv>							=> launch_scripteditor(<partOrEquiv>);
`);

XTalk.ImportGrammar('messageCall',`
{<message> | "<message>"} <expressionList>					=>	_.the_result = (yield*(this.handlers.<message>||XTalk.cu('<message>'))(<expressionList>));
`);

XTalk.ImportGrammar('',`

<if> 	= if <expression> <then> 				=> if (boolean(<expression>)) /**/{/* +then */ <then>
<if> 	= if <expression> 		 				=> if (boolean(<expression>)) /**/{/* +then */

<then> 	= then <if>								=> /* -then *//* +else}? */ <if>
<then> 	= then <repeat>							=> /* -then *//* +else}? */ <repeat>
<then> 	= then <scriptLine> <else>				=> /* -then *//**/ <scriptLine> /**//* +else}? */ <else>
<then> 	= then <scriptLine> 					=> /* -then *//**/ <scriptLine> /**//* +else}? */
<then> 	= then									=> /* -then *//**/ /**//* +endif,else?! */

<else> 	= else <if>								=> /* -else */}/* */ else <if>
<else> 	= else <repeat> 						=> /* -else */}/**/ else <repeat>
<else> 	= else <scriptLine> <else>				=> /* -else */}/**/ else <scriptLine> <else>
<else> 	= else <scriptLine> 					=> /* -else */}/**/ else { <scriptLine> }
<else> 	= else 									=> /* -else */}/**/ else  /**/{/* +endif?! */

<endif>	= end if <else>							=> /* -endif */}/**/ <else>
<endif>	= end if								=> /* -endif */}/**/

<repeat> = repeat while <expression>			=> while (boolean(<expression>)) /**/{/* +repeat?! */
<repeat> = repeat until <expression>			=> while (!boolean(<expression>)) /**/{/* +repeat?! */
<repeat> = repeat with <variable> {=|is} <expression> <downToOrTo> <expression>
=> for (var <variable>$ = <expression>; (_.<variable>=<variable>$) <= <expression>; <variable>$<downToOrTo>) /**/{/* +repeat?! */
<repeat> = repeat with <factor> {=|is} <expression> <downToOrTo> <expression>
=> for (var VAR$ = <expression>, CTR$ = <factor>; (_[CTR$]=VAR$) <= <expression>; VAR$<downToOrTo>) /**/{/* +repeat?! */
<repeat> = repeat forever						=> while (true) /**/{/* +repeat?! */
<repeat> = repeat [for] <expression> [times]	=> for (var _n=1; _n <= number(<expression>); _n++) /**/{/* +repeat?! */
<repeat> = repeat								=> while (true) /**/{/* +repeat?! */
<downToOrTo> = down to => --
<downToOrTo> = to => ++

<endrepeat> = end repeat <else>					=> /* -repeat */}/**/ <else>
<endrepeat> = end repeat 						=> /* -repeat */}/**/
<exitrepeat> = exit repeat						=> /* @repeat *//**/ break;
<nextrepeat> = next repeat						=> /* @repeat *//**/ continue;

`);

XTalk.ImportGrammar('command', `
<if> | <then> | <else> | <endif>
<repeat> | <exitrepeat> | <nextrepeat> | <endrepeat>
#
return <expression>											=>	return <expression>;
exit <handlerName> | return									=>  return "";
pass <handlerName>											=>  return (yield*xtalk_pass_coroutine('<handlerName>', arguments, this.me));
exit to hypercard											=>  throw(XTalk.exitToHyperCard);
end [<extratext>]											=>  /*unknownEnd*/
#
wait until <expression>										=>  { console.log('wait until '+\`<expression>\`+'…'); while (!boolean(<expression>)) yield({ timeout: 50 }); console.log('done'); }
wait while <expression>										=>  { console.log('wait while '+\`<expression>\`+'…'); while (boolean(<expression>)) yield({ timeout: 50 });  console.log('done'); }
wait [for] <expression> {second|seconds|sec|secs} 			=>  { yield({timeout: number(<expression>)*1000}); }
wait [for] <expression> [tick|ticks]			 			=>  { yield({timeout: number(<expression>)*1000/60}); }
#
debugger;													=>  { if (body.classList.contains('javascript')) debugger; }
log <part>													=>  console.log(<part>);
log <expressionList>										=>  console.log(<expressionList>);
`);

// in HC you could get the name of "cd fld (1+1)" , we support this too
XTalk.ImportGrammar('partOrEquiv',`
<part>
<factor>														=>  (yield*( new ((function*(){}).constructor)( '_', 'return '+XTalk.Translate('part', <factor>) ).bind(this) )(new XTalk.EchoProxy({})))
`);

XTalk.ImportGrammar('part',`
me															=>	this.me
the {selectedPart|selPart}									=>  this.stackOf().selectedPart
[the] [short|abbr|abbrev|abbreviated] target						=>  XTalkQueue.Active.Target
[the] owner of <card>										=>  <card>.owner
the selection												=>  window.getSelection().toString()
the palette													=>  this.me.palette
<buttonOrField>
[the] {card|cd} window 										=>  this.stackOf().parentNode.cardWindowDelegate()
<card>
<background>
<stack>
<menu>
<menuItem>
window <factor> | {msg} 										=>  ({ pretendWindow: true })
file <factor>												=>  ({ pretendFile: true })
`);

XTalk.ImportGrammar('menu',`
menu <factor>												=> this.stackOf().parentNode.getMenu(<factor>,true)
`);

XTalk.ImportGrammar('menuItem',`
<ordinal> menuItem {of|in|from} <menu>						=> (this.selectOf('title-bar-menuitem', 'ordinal', <ordinal>, <menu>, true) || {pretendMenuItem:true})
menuItem <identOrExprOf> <menu>	[with {menuMessage|menuMessages|menuMsg|menuMsgs} <expression>]			=> (this.selectOf('title-bar-menuitem', '', <identOrExprOf>, <menu>, true) || {pretendMenuItem:true})
`);

XTalk.ImportGrammar('partWithContents',`
<buttonOrField>
<menu>
<menuItem>
`);

XTalk.ImportGrammar('buttonOrField',`
<ordinal> [bg|bkgnd|background] {field|fld} {of|in} <card> 	=> ((c)=>this.selectOf('field-part', 'ordinal', <ordinal>, (c=<card>).background).contentsProxyForCard(c))()
[bg|bkgnd|background] {field|fld} <number> {of|in} <card> 	=> ((c)=>this.selectOf('field-part', 'number', <number>, (c=<card>).background).contentsProxyForCard(c))()
[bg|bkgnd|background] {field|fld} <string> {of|in} <card> 	=> ((c)=>this.selectOf('field-part', 'name', <string>, (c=<card>).background).contentsProxyForCard(c))()
[bg|bkgnd|background] {field|fld} <idOrEmpty> <identOrFactorOf> <card> => ((c)=>this.selectOf('field-part', <idOrEmpty>, <identOrFactorOf>, (c=<card>).background).contentsProxyForCard(c))()

<ordinal> <bgOrCd> {button|btn} {of|in} <partOrEquiv>				=>  this.selectOf('button-part', 'ordinal', <ordinal>, <partOrEquiv>.<bgOrCd>)
<ordinal> <bgOrCd> {button|btn} 									=>  this.selectOf('button-part', 'ordinal', <ordinal>, this.stackOf().<bgOrCd>)
<bgOrCd> {button|btn} <number> {of|in} <partOrEquiv>				=>  this.selectOf('button-part', 'number', <number>, <partOrEquiv>.<bgOrCd>)
<bgOrCd> {button|btn} <string> {of|in} <partOrEquiv>				=>  this.selectOf('button-part', 'name', <string>, <partOrEquiv>.<bgOrCd>)
<bgOrCd> {button|btn} <idOrEmpty> <identOrFactorOf> <partOrEquiv>	=>	this.selectOf('button-part', <idOrEmpty>, <identOrFactorOf>, <partOrEquiv>.<bgOrCd>)
<bgOrCd> {button|btn} <number> 										=>  this.selectOf('button-part', 'number', <number>, this.stackOf().<bgOrCd>)
<bgOrCd> {button|btn} <string> 										=>  this.selectOf('button-part', 'name', <string>, this.stackOf().<bgOrCd>)
<bgOrCd> {button|btn} <idOrEmpty> <factor>		 					=>	this.selectOf('button-part', <idOrEmpty>, <factor>, this.stackOf().<bgOrCd>)

<ordinal> <cdOrBg> {field|fld} {of|in} <partOrEquiv>				=>  this.selectOf('field-part', 'ordinal', <ordinal>, <partOrEquiv>.<cdOrBg>)
<ordinal> <cdOrBg> {field|fld} 										=>  this.selectOf('field-part', 'ordinal', <ordinal>, this.stackOf().<cdOrBg>)
<cdOrBg> {field|fld} <number> {of|in} <partOrEquiv>					=>  this.selectOf('field-part', 'number', <number>, <partOrEquiv>.<cdOrBg>)
<cdOrBg> {field|fld} <string> {of|in} <partOrEquiv>					=>  this.selectOf('field-part', 'name', <string>, <partOrEquiv>.<cdOrBg>)
<cdOrBg> {field|fld} <idOrEmpty> <identOrFactorOf> <partOrEquiv>		=>	this.selectOf('field-part', <idOrEmpty>, <identOrFactorOf>, <partOrEquiv>.<cdOrBg>)
<cdOrBg> {field|fld} <number> 										=>  this.selectOf('field-part', 'number', <number>, this.stackOf().<cdOrBg>)
<cdOrBg> {field|fld} <string> 										=>  this.selectOf('field-part', 'name', <string>, this.stackOf().<cdOrBg>)
<cdOrBg> {field|fld} <idOrEmpty> <factor>							=>	this.selectOf('field-part', <idOrEmpty>, <factor>, this.stackOf().<cdOrBg>)

<ordinal> <bgOrCd> {part} {of|in} <partOrEquiv>						=> 	this.selectOf(['button-part','field-part'], 'ordinal', <ordinal>, <partOrEquiv>.<bgOrCd>)
<ordinal> <bgOrCd> {part} 											=> 	this.selectOf(['button-part','field-part'], 'ordinal', <ordinal>, this.stackOf().<bgOrCd>)
<bgOrCd> {part} <number> {of|in} <partOrEquiv>						=>  this.selectOf(['button-part','field-part'], 'number', <number>, <partOrEquiv>.<bgOrCd>)
<bgOrCd> {part} <string> {of|in} <partOrEquiv>						=>  this.selectOf(['button-part','field-part'], 'name', <string>, <partOrEquiv>.<bgOrCd>)
<bgOrCd> {part} <idOrEmpty> <identOrFactorOf> <partOrEquiv>			=>	this.selectOf(['button-part','field-part'], <idOrEmpty>, <identOrFactorOf>, <partOrEquiv>.<bgOrCd>)
<bgOrCd> {part} <number> 											=>  this.selectOf(['button-part','field-part'], 'number', <number>, this.stackOf().<bgOrCd>)
<bgOrCd> {part} <string> 											=>  this.selectOf(['button-part','field-part'], 'name', <string>, this.stackOf().<bgOrCd>)
<bgOrCd> {part} <idOrEmpty> <factor>		 							=>	this.selectOf(['button-part','field-part'], <idOrEmpty>, <factor>, this.stackOf().<bgOrCd>)

me																	=>  this.me
[the] target														=>  XTalkQueue.Active.Target
`);

XTalk.ImportGrammar('card',`
[the] <cardOrdinal> marked {card|cd} {of|in} <background>	=> 	XTalk.CardOf(this.stackOf(), <cardOrdinal>, true, <background>)
[the] <cardOrdinal> {card|cd} {of|in} <background>			=> 	XTalk.CardOf(this.stackOf(), <cardOrdinal>, false, <background>)
[the] <cardOrdinal> marked {card|cd} 						=> 	XTalk.CardOf(this.stackOf(), <cardOrdinal>, true)
[the] <cardOrdinal> {card|cd} 								=> 	XTalk.CardOf(this.stackOf(), <cardOrdinal>)

marked {card|cd} <string> {of|in} <background> 				=>	this.selectOf('card-part[marked]:not([marked="false" i])', 'name', <string>, <background>)
marked {card|cd} <idOrEmpty> <identOrFactorOf> <background> 	=>	this.selectOf('card-part[marked]:not([marked="false" i])', <idOrEmpty>, <identOrFactorOf>, <background>)
marked {card|cd} <idOrEmpty> <factor>						=>	this.selectOf('card-part[marked]:not([marked="false" i])', <idOrEmpty>, <factor>, this.stackOf())
{card|cd} <string> {of|in} <background> 					=>	this.selectOf('card-part', 'name', <string>, <background>)
{card|cd} <idOrEmpty> <identOrFactorOf> <background> 		=>	this.selectOf('card-part', <idOrEmpty>, <identOrFactorOf>, <background>)
{card|cd} <string> 						 					=>	this.selectOf('card-part', 'name', <string>, this.stackOf())
{card|cd} <idOrEmpty> <factor>								=>	this.selectOf('card-part', <idOrEmpty>, <factor>, this.stackOf())

[the] recent {card|cd}										=>  this.stackOf().recentCard
[this|the] {card|cd}										=>	this.stackOf().card
`);
XTalk.ImportGrammar('background',`
[the] <cardOrdinal> {background|bkgnd|bg} 					=> 	XTalk.BackgroundOf(this.stackOf(), <cardOrdinal>)
{background|bkgnd|bg} <string> 								=>	this.selectOf('background-part', 'name', <string>, this.stackOf())
{background|bkgnd|bg} <idOrEmpty> <factor> 					=>	this.selectOf('background-part', <idOrEmpty>, <factor>, this.stackOf())
[this|the] {background|bkgnd|bg}							=>	this.stackOf().background
`);
XTalk.ImportGrammar('stack',`
[this|the] stack											=>	this.stackOf()
`);

function is_equal(a,b) {
if (a===b)
return true;
if (a!=="" && b!=="" && !isNaN(a) && !isNaN(b))
return (Number(a)===Number(b));
return (String(a).toLowerCase() === String(b).toLowerCase());
}
function is_less(a,b) {
if (typeof a === 'number' && typeof b === 'number')
return (a < b);
if (a!=="" && b!=="" && !isNaN(a) && !isNaN(b))
return (Number(a) < Number(b));
return (String(a).toLowerCase() < String(b).toLowerCase());
}
function is_more(a,b) {
if (typeof a === 'number' && typeof b === 'number')
return (a > b);
if (a!=="" && b!=="" && !isNaN(a) && !isNaN(b))
return (Number(a) > Number(b));
return (String(a).toLowerCase() > String(b).toLowerCase());
}

XTalk.ImportGrammar('expression', `
<expression> or <expression>								=>	boolean(<expression>) || boolean(<expression>)
<expression> and <expression>								=>	boolean(<expression>) && boolean(<expression>)
<factor> is {a|an} number									=>  !!((v)=>String(v) && !isNaN(v))(<factor>)
| <factor> is not {a|an} number								=>  !((v)=>String(v) && !isNaN(v))(<factor>)
| <factor> is {a|an} integer									=>  !!((v)=>String(v) && !isNaN(v) && Number.isInteger(Number(v)))(<factor>)
| <factor> is not {a|an} integer								=>  !((v)=>String(v) && !isNaN(v) && Number.isInteger(Number(v)))(<factor>)
| <factor> is {a|an} logical									=>  ['true','false'].includes(String(<factor>).toLowerCase())
| <factor> is not {a|an} logical								=>  !['true','false'].includes(String(<factor>).toLowerCase())
| <factor> is {a|an} point										=>  ((v)=>{ try { point(v); return true; } catch(e) { } return false; })(<factor>)
| <factor> is not {a|an} point									=>  ((v)=>{ try { point(v); return false; } catch(e) { } return true; })(<factor>)
| <factor> is {a|an} {rect|rectangle}							=>  ((v)=>{ try { rectangle(v); return true; } catch(e) { } return false; })(<factor>)
| <factor> is not {a|an} {rect|rectangle}						=>  ((v)=>{ try { rectangle(v); return false; } catch(e) { } return true; })(<factor>)
| <factor> is {a|an} date										=>  !isNaN(Date.parse(<factor>))
| <factor> is not {a|an} date									=>  isNaN(Date.parse(<factor>))
<expression> is within <expression>							=>	((p,r)=>(p[0]>=r[0] && p[0]<r[2] && p[1]>=r[1] && p[1]<r[3]))(point(<expression>),rectangle(<expression>))
| <expression> is not within <expression>					=>	!((p,r)=>(p[0]>=r[0] && p[0]<r[2] && p[1]>=r[1] && p[1]<r[3]))(point(<expression>),rectangle(<expression>))
| <expression> { ≠ | <> | is not [in]- } <expression>	   					 	=> !is_equal(<expression>,<expression>)
| <expression> { = | equals | is [less|more|in|not in]- } <expression>	 		=> is_equal(<expression>,<expression>)
<expression> { is {smaller|less} [than] or equal to | ≤ | <= } <expression>		=> !is_more(<expression>,<expression>)
| <expression> { is {greater|more} [than] or equal to | ≥| >= } <expression>	=> !is_less(<expression>,<expression>)
| <expression> { is {smaller|less} than | < } <expression>						=> is_less(<expression>,<expression>)
| <expression> { is {greater|more} than | > } <expression>						=> is_more(<expression>,<expression>)

| <expression> contains <expression>						=>	!!((a,b)=>b.length && a.includes(b))(String(<expression>).toLowerCase(),String(<expression>).toLowerCase())
| <expression> is in <expression>							=>	!!((b,a)=>b.length && a.includes(b))(String(<expression>).toLowerCase(),String(<expression>).toLowerCase())
| <expression> is not in <expression>						=>	!((b,a)=>b.length && a.includes(b))(String(<expression>).toLowerCase(),String(<expression>).toLowerCase())
<expression> & <expression>									=>	[<expression>, <expression>].join('')
| <expression> && <expression>								=>	[<expression>, <expression>].join(' ')
<expression> { plus | + } <expression>						=>	number(<expression>) + number(<expression>)
| <expression> { minus | <hyphen> } <expression>			=>	number(<expression>) - number(<expression>)
<expression> { times | * } <expression>						=>	number(<expression>) * number(<expression>)
| <expression> { divided by | / } <expression>				=>	number(<expression>) / number(<expression>)
| <expression> div <expression>								=>	Math.floor( number(<expression>) / number(<expression>) )
| <expression> mod <expression>								=>	number(<expression>) % number(<expression>)
<exponent>
<factor>
`);
XTalk.ImportGrammar('factor',`
[the] number of {cards|cds} {of|in} <background> 		 	=>	Array.from(this.stackOf().qsa('card-part')).filter((c)=>(c.bkgndID==<background>.id)).length
[the] number of {cards|cds}	[{of|in} [this|the] stack]			=>	this.stackOf().qsa('card-part').length
[the] number of marked {cards|cds} [{of|in} [this|the] stack]		=>	this.stackOf().qsa('card-part[marked]:not([marked="false" i])').length
[the] number of {backgrounds|bkgnds|bgs} [{of|in} [this|the] stack]	=>	this.stackOf().qsa('background-part').length
[the] number of <bgOrCd> {buttons|btns} {of|in} <part>		=>	<part>.<bgOrCd>.qsa('button-part').length
[the] number of <bgOrCd> {buttons|btns} 					=>	this.stackOf().<bgOrCd>.qsa('button-part').length
[the] number of <cdOrBg> {fields|flds} {of|in} <part>		=>	<part>.<cdOrBg>.qsa('field-part').length
[the] number of <cdOrBg> {fields|flds} 						=>	this.stackOf().<cdOrBg>.qsa('field-part').length
[the] number of <bgOrCd> {parts} {of|in} <part> 			=>	this.stackOf().<bgOrCd>.qsa('button-part,field-part').length
[the] number of <bgOrCd> {parts} 							=>	this.stackOf().<bgOrCd>.qsa('button-part,field-part').length
[the] number of <chunkType> {of|in} <factor> 				=> XTalkChunk(['<chunkType>', 'number', null], <factor>, [])
#
there is {not a | no | a} stack <factor> 					=>  true

there is {a|an} <part>										=>  (yield*(function*(){ try{ return (<part> instanceof HTMLElement);} catch(e){if(e instanceof XTalk.NoSuch)return false; throw e;} }).call(this))
there is {no|not a|not an} <part>							=>  (yield*(function*(){ try{return !(<part> instanceof HTMLElement);} catch(e){if(e instanceof XTalk.NoSuch)return true; throw e;} }).call(this))
#
value(<expression>) | [the] value of <expression>
=>  (yield*xtalk_value_coroutine(this, _, <expression>))

param(<expression>)											=>  ((p)=>((p===undefined) ? '' : p))(arguments[number(<expression>)-1])
[the] param of <factor>										=>  ((p)=>((p===undefined) ? '' : p))(arguments[number(<factor>)-1])
paramCount() | [the] paramCount 	 						=>  arguments.length
params() | [the] params 									=>  ""
[the] {selectedButton|selectedBtn} of <bgOrCd> family <factor>
=> ((this.selectOf('button-part[hilite="true" i][family="'+<factor>+'" i]','number',1,this.stackOf().<bgOrCd>,true)||{}).longName||'')

[the] {textFont|textSize|textStyle|textHeight} {of|in} <chunkList> <part>		=> ""

# the x of y is tricky.
[the] [<oneParamBuiltin>]- <property> of <part>					=>	<part>.<property>
[the] [[<propertyBuiltin>]-]- <property> of <partOrEquiv>		=> <partOrEquiv>.<property>

<partPossessive> <property>									=>	<partPossessive>.<property>
the result													  =>	_.the_result
the short target											=>  XTalkQueue.Active.Target.name
the [abbr|abbrev|abbreviated|long] target						=>  XTalkQueue.Active.Target.longName
target														=> XTalkQueue.Active.Target.contents
<chunkList> <factor> <possessiveChunkList>					=> XTalkChunk([<chunkList>], <factor>, [<possessiveChunkList>])
<chunkList> <factor> 										=> XTalkChunk([<chunkList>], <factor>, [])
<factor> <possessiveChunkList>								=> XTalkChunk([], <factor>, [<possessiveChunkList>])

the <message> {of|in} <factor>								=> (yield*this.functions.<message>(<factor>))
<oneParamBuiltin> {of|in} <factor>							=> (yield*this.functions.<oneParamBuiltin>(<factor>))
not <factor>													=> !boolean(<factor>)
<partWithContents>											=> <partWithContents>.contents
me															=> (['BUTTON-PART','FIELD-PART'].includes(this.me.nodeName) ? this.me.contents : this.me.longName)
<part>														=> <part>.longName
#
the [short|abbr|abbrev|abbreviated|long] date				=> (yield*sim.functions.date())
the [short|abbr|abbrev|abbreviated|long] time				=> (yield*sim.functions.time())
the long version 											=> (yield*(sim.functions.longVersion||XTalk.cu('long version'))())
[the] <message>(<expressionList>)							=>  (yield*(this.functions.<message>||XTalk.cu('<message>'))(<expressionList>))
the <message>												=>	(yield*(sim.functions.<message>||XTalk.cu('<message>'))())
<variable>													=>	_.<variable>
<hyphen><factor>											=>	-number(<factor>)
(<expression>)												=>	(<expression>)
<number> | <string> | <hcjunk>
`);
XTalk.ImportGrammar('',`
<exponent> = <factor>^<exponent>								=>	Math.pow(<factor>, <exponent>)
<exponent> = <factor>^<factor>								=>	Math.pow(<factor>, <factor>)
<scriptLine> = { <command> | <statement> | <messageCall> }
<expressionList> = [ <exprOrEmpty> [, <exprOrEmpty> ]* ]
<exprOrEmpty> = <expression>
<exprOrEmpty> = [] => ""
<parameterList> = [ <parameter> [, <parameter> ]* ]
<message> | <variable> | <handlerName> = <identifier>

<property> = short name => name
<property> = [abbr|abbrev|abbreviated|long] name => longName

<property> = [short|abbr|abbrev|abbreviated] id => id
<property> = long id => longID

<property> = [short|abbr|abbrev|abbreviated|long] number => number

<property> = style => type
<property> = <identifier>
<bgOrCd> = {background|bkgnd|bg} => background
<bgOrCd> = [card|cd] => card
<cdOrBg> = {card|cd} => card
<cdOrBg> = [background|bkgnd|bg] => background
<idOrEmpty> = id => 'id'
<idOrEmpty> = [] => ''
<globalList> = <globalDec> [, <globalDec> ]*
<globalDec> = <variable>									=> (_.$global.<variable>=true)
<identOrFactorOf> = [<oneParamBuiltin>]- <identifier> {of|in}						=> _.<identifier>
<identOrFactorOf> = <factor> {of|in}							=> <factor>
<partPossessive> = <part>'s 								=> <part>
<partPossessive> = my 										=> this.me
<expressionWithCommas> = <expressionWithCommasInner>		=> [<expressionWithCommasInner>].join(',')
<expressionWithCommas> = <expression>
<expressionWithCommasInner> = <expression> {, <expression>}*
<expressionEndOfScriptLine> = <expression> <endOfScriptLine>

<factorsWithSpaces> = <factorsWithSpacesInner>		=> [<factorsWithSpacesInner>].join(' ')
<factorsWithSpacesInner> = <factorOrText> [ <impliedSpace> <factorOrText> ]*
<factorOrText> = <factor>
<factorOrText> = <extratext> => \`<extratext>\`
<impliedSpace> = [] => ,

<addSubtract> = add => +
<addSubtract> = subtract => -
<multiplyDivide> = multiply => *
<multiplyDivide> = divide => /

<cardOrdinal> = {prev|previous} 	=> 'prev'
<cardOrdinal> = next 				=> 'next'
<cardOrdinal> = <ordinal>

<oneParamBuiltin> = { random | round | sqrt | trunc | sin | cos | tan | atan | exp | exp1 | exp2 | ln | ln1 | log2 | abs | charToNum | numToChar | length | param }
<propertyBuiltin> = [short|long|abbr|abbrev|abbreviated] { autoHilite | autoSelect | autoTab | botRight | bottom | bottomRight | cantAbort | cantDelete | cantModify | cantPeek | dontSearch | dontWrap | editBkgnd | enabled | family | fixedLineHeight | height | highlight | highlite | hilight | hilite | icon | id | left | loc | location | lockText | marked | name | number | owner | partNumber | rect | rectangle | right | script | scroll | sharedHilite | sharedText | showLines | showName | showPict | size | style | textAlign | textFont | textHeight | textSize | textStyle | top | topLeft | userModify | version | visible | wideMargins | width }

`, { show_to_user: true });

XTalk.Rules['factorOrText'][0].options = {
postflight(text,index,Packrat)
{
// if there's a nonspace right after this, don't accept
var nonspaceafter = !!/[\S]/.test(text[index] || '');
//console.log('after factorOrText[0]: ' + text[index], nonspaceafter);
//if (nonspaceafter) debugger;
return !nonspaceafter;
}
}

XTalk.Rules['factorOrText'][1].options = {
postflight(text,index,Packrat)
{
//console.log('after factorOrText[1]:' + text.substr(index));
return true;
}
}


XTalk.Support('identifier', /* /^[A-Z_][A-Z_\d]*i/ */ /^[a-zA-ZÀ-ž_][a-zA-ZÀ-ž_0-9]*/i, '', {
preflight(text,index,Packrat) {
if (/(then|the|else)([^A-Z\d]|$)/iy.test(text.substr(index,5))) return false; 	/* "the" is not an identifer */
return true;
}
});
XTalk.Support('hyphen', /\-/i, '', { preflight(text,index,Packrat) { 	/* -- is hypercard comment */
if (/\-\-/i.test(text.substr(index,2))) return false;
return true;
} });
XTalk.Rules['handlerName'][0].options = {
preflight(text,index,Packrat) {
/* handlerName has to match the currently compiling handler */
var literal = text.substr(index).match(/^[A-Z_][A-Z_\d]*/i);
var matched = (literal && XTalk.CurrentHandler && literal[0].toLowerCase() === XTalk.CurrentHandler.toLowerCase());
return matched;
}
};
XTalk.Support('number', /[.]?[\d]+([\.][\d]+)?/, '', {
postproduce(out)
{ /*console.log(out);*/ while ((/^[0][0-9]/).test(out[0])) out[0] = out[0].substr(1); return true; }
});
XTalk.Support('string', /"[^"]*"/, '', {
postproduce(out)
{ out[0] = out[0].replaceAll("\\", "\\\\"); return true; }
});
XTalk.Support('string', /"[^"]+$/, '', {
postproduce(out) 	// string with no end quote is allowed in HC
{ out[0] = out[0].replaceAll("\\", "\\\\") + '"'; return true; }
});
XTalk.Support('string', /\'[^\']*\'/);
XTalk.Support('linefeed', /[^\S\n]*(--[^\n]*)?([\n]|$)/, ' ');
XTalk.Support('wholeline', /[^\n]*/);
XTalk.Support('extratext', /[^/S\n]*[^\n\-]+/);
// hc allowed periods and some other non syntax as singleton characters. weird
//XTalk.Support('hcjunk', /[.]/, "'.'");
XTalk.Support('hcjunk', "\\", "\"\\\\\"");
XTalk.Support('hcjunk', "<hcjunkpunct>", "\"<hcjunkpunct>\"");
XTalk.Support('hcjunk', "<hcjunkKatakana>", "\"<hcjunkKatakana>\"");
XTalk.Support('hcjunkpunct', /[`~#$%_.?;:]/);
XTalk.Support('hcjunkKatakana', /[\p{Script_Extensions=Katakana}]/u);

XTalk.Support('handler-line', "[ <scriptLine> ] <linefeed>");

/*
1. having <factor> = <factor> <possessiveChunkList> works. But
having <factor> = <chunkedFactor>
<chunkedFactor> = <factor> <possessiveChunkList> doesn't. Gotta trace the LR
√	2. can't have a list of possessivechunks left to right! Have to do them in reverse order, so maybe as recursive rule.
√	3. Reversing things in the parser makes them evaluate in an unusual order. Maybe it doesn't matter.
√	4. What about "first char of value's second word"? Can we roll it all together?
5. [the] <message> of <factor>'s chunk   is going to be weird.
6. set the third word of cd btn 22 of this card's name to
looks like: the third word of cd btn 22 of (this card's name)
parses as: the third word of (cd btn 22 of this card)'s name
*/

// put line X of card field "starters" into starters
// put line (X of card field "starters") into starters

XTalk.ImportGrammar('',`
<chunkType> = {character|characters|char|chars|word|words|line|lines|item|items}
<chunkList> = { <chunkOf> }*
<possessiveChunkList> = { <possessiveChunk> }*
<chunkOf> = <ordinal> <chunkType> {of|in}						=> '<chunkType>', <ordinal>, null,
<chunkOf> = <chunkType> <identOrExprTo> <identOrExprOf> 		=> '<chunkType>', number(<identOrExprTo>), number(<identOrExprOf>),
<chunkOf> = <chunkType> <identOrExprOf> 						=> '<chunkType>', number(<identOrExprOf>), null,
<possessiveChunk> = 's <ordinal> <chunkType>					=> '<chunkType>', <ordinal>, null,
<possessiveChunk> = 's <chunkType> <identOrExprTo> <identOrFactor>	=> '<chunkType>', number(<identOrExprTo>), number(<identOrFactor>),
<possessiveChunk> = 's <chunkType> <identOrFactor>				=> '<chunkType>', number(<identOrFactor>), null,
<identOrExprOf> = [<oneParamBuiltin>]- <identifier> {of|in}		=> _.<identifier>
<identOrExprOf> = <expression> {of|in}							=> <expression>
<identOrExprTo> = <identifier> to								=> _.<identifier>
<identOrExprTo> = <expression> to								=> <expression>
<identOrFactor> = <identifier>									=> _.<identifier>
<identOrFactor> = <factor>										=> <factor>
<ordinal> = [the] first											=> 1
<ordinal> = [the] second										=> 2
<ordinal> = [the] third											=> 3
<ordinal> = [the] fourth										=> 4
<ordinal> = [the] fifth											=> 5
<ordinal> = [the] sixth											=> 6
<ordinal> = [the] seventh										=> 7
<ordinal> = [the] eighth										=> 8
<ordinal> = [the] ninth											=> 9
<ordinal> = [the] tenth											=> 10
<ordinal> = [the] {middle|mid}									=> 'middle'
<ordinal> = [the] last											=> 'last'
<ordinal> = any													=> 'any'
#<chunkCount> = [the] number of <chunkType> {of|in} <factor> 	=> XTalkChunk(['<chunkType>', 'number', null], <factor>, [])
`, { show_to_user: true });

// first chunk of second chunk of value's fourth chunk's third chunk
function XTalkChunk(ofchunks, value, posschunks, return_range)
{
value = String(value);
var delimiter = "", delimiter_addition = "", start = 0, end = value.length;

while (posschunks.length >= 3)
ofchunks.push(posschunks.shift(), posschunks.shift(), posschunks.shift());
//console.log(ofchunks);

function*lineitemiterator(delim)
{
var i = start;
do
{
var chunkstart = i;
while (i < end && value[i] !== delim)
i++;
yield [chunkstart, i];
}
while (++i <= end);
}
function*worditerator()
{
var i = start;
do
{
while (i < end && /\s/.test(value[i]))
i++;
var chunkstart = i;
while (i < end && !/\s/.test(value[i]))
i++;
yield [chunkstart, i];
}
while (i < end);
}

var type;
for (var c = ofchunks.length - 3; c >= 0; c -= 3)
{
type = ofchunks[c][0].toLowerCase();
var from = ofchunks[c+1], to = ofchunks[c+2];

if (type == 'c')
{
delimiter = "";

if (from==='last')
start = Math.max(start, end - 1);
else if (from==='middle') {
start += Math.ceil((end-start)/2);
end = Math.min(end, start+1);
}
else if (from=='any') {
start += Math.floor(Math.random()*(end-start));
end = Math.min(end, start+1);
}
else if (from=='number')
return end - start;
else {
var newstart = start + Math.max(1,from) - 1;
end = Math.min(end, (to===null) ? newstart + 1 : start + to);
start = newstart;
}
}
else
{
var removableFinalDelimiter = delimiter = (type == 'i') ? (sim.itemDelimiter || ',') : (type == 'l') ? '\n' : '';

var iter = delimiter ? lineitemiterator(delimiter) : (type == 'w') ? ((delimiter=' '),worditerator()) : null;

var next, chunks = [];
while (!(next=iter.next()).done)
chunks.push(next.value);

// do not include any final spaces in word chunk
if (type == 'w' && chunks[chunks.length-1][0]===chunks[chunks.length-1][1] && chunks.length > 1)
chunks.pop();
//console.log(chunks);
var startvalue, endvalue;
if (from==='last')
startvalue = endvalue = chunks[chunks.length-1];
else if (from==='middle')	// middle of 5 is 3 = [2], middle of 6 is 4 = [3]
startvalue = endvalue = chunks[Math.floor(chunks.length/2)];
else if (from==='any')
startvalue = endvalue = chunks[Math.floor(Math.random()*chunks.length)];
else if (from=='number') {
var adjust = 0;
if (removableFinalDelimiter && end-start >= removableFinalDelimiter.length
&& value.substr(end-removableFinalDelimiter.length,removableFinalDelimiter.length) == removableFinalDelimiter)
adjust = -1;
return chunks.length + adjust;
}
else {
from = Math.max(1, Math.min(chunks.length+1, from));
startvalue = chunks[from-1];
if (!startvalue)
{ to=null; startvalue = [end,end]; delimiter_addition += delimiter.repeat(from-chunks.length); }
endvalue = (to===null) ? startvalue : chunks[Math.max(1, Math.min(chunks.length, to))-1];
}

start = startvalue[0]; end = endvalue[1];
}
}
// now we have the range
//console.log('range',start,end,delimiter_addition);

if (return_range)
{
if (return_range == 'includeTrailing')
{
if (type == 'w')
{
delimiter = new RegExp(/[ ]*/, 'y');
delimiter.lastIndex = end;
var match = delimiter.exec(value);
end += match[0].length;
// also include leading spaces IF its the last word...hang on...
while (start > 0 && value[start-1]===' ')	// this should stop in the context of the other chunk....
start--;
}
else if (delimiter)
{
// delete will also kill the following delimiter, and in the case of word, it should trim the front
delimiter = new RegExp(delimiter, 'y');
delimiter.lastIndex = end;
var match = delimiter.exec(value);
if (match)
end += match[0].length;
}
}

return [start,end,delimiter_addition];		// HC added commas or returns to help your put intos, and delete will also kill the following delimiter
}

return value.substring(start,end);
}


XTalk.DefaultMainScript = `

-- Messages are sent to buttons, fields, cards, backgrounds, and stacks. The targets can catch them in script handlers. If they are not caught, they are sent down the message path to their containing cards and backgrounds, and then the stack.

-- when the mouse (or finger) is pressed in the stack:

on mouseDown
-- when the click or touch starts on a button, field, or card
end mouseDown

on mouseStillDown
-- while the mouse continues the click
end mouseStillDown

on mouseUp
-- when the mouse or finger releases the click
end mouseUp

on mouseEnter
-- when the mouse enters a button, field, or card
end mouseEnter

on mouseWithin
-- while the mouse remains inside
end mouseWithin

on mouseLeave
-- when the mouse leaves the part
end mouseLeave

-- these message are sent while the stack is navigated: openStack, openBackground, openCard, closeCard, closeBackground, closeStack

on openStack
-- when a stack is opened, this message is sent
end openStack

on openBackground
-- when the background changes, this message is sent
end openBackground

on openCard
-- when the card changes, this message is sent
end openCard

on closeCard
-- this message is sent to the closing card before the next one gets openCard
end closeCard

on closeBackground
-- this message is sent to the closing background.
end closeBackground

on closeStack
-- this message is sent to the stack when closing.
end closeStack

-- these messages are sent when the selection focus moves.

on openField
-- this message is sent to a field when editing begins.
end openField

on closeField
-- this message is sent to a field when editing ends and the contents have changed.
end closeField

on exitField
-- this message is sent to the card when editing ends and the contents have NOT changed.
end exitField

-- these messages are sent when the keyboard is used in the stack.

on keyDown which
-- sent when a keyboard key is pressed
put charToNum(which) into ascii
put word 2 of the target is "field" into targetIsField
if ascii is 28 and not (targetIsField and the textArrows) then send "arrowKey left" to the target
else if ascii is 29 and not (targetIsField and the textArrows) then send "arrowKey right" to the target
else if ascii is 30 and not (targetIsField and the textArrows) then send "arrowKey up" to the target
else if ascii is 31 and not (targetIsField and the textArrows) then send "arrowKey down" to the target
else if ascii is 9 then send "tabKey" to the target
else if (ascii is 10 or ascii is 13) and targetIsField then send "returnInField" to the target
else if (ascii is 10 or ascii is 13) and not targetIsField then send "returnKey" to the target
else if the blindTyping then
if (!document.activeElement || document.activeElement.matches('div,field-part,card-part') || !window.messagebox_input) return;
put which
getSelection().selectAllChildren(window.messagebox_input);
getSelection().collapseToEnd();
end if
end keyDown

on arrowKey which
-- arrowKey is sent when you push an arrow key on the keyboard, but not in a field when the textArrows is true
if which is left then go previous card
else if which is right then go next card
else if which is down then go back
else if which is up then go forth
else
throw "Can't understand arguments of arrowKey.";
end if
end arrowKey

on returnInField
-- sent when you press return in a field
end returnInField

on returnKey
-- sent when you press return but not in a field.
end returnKey

on tabKey
-- sent when you press tab
end tabKey

on idle
-- this message will be sent repeatedly to the current card
end idle

-- and here are some handlers you can use by typing their name in the message box.

on help
go home
sim.stack.card = this.selectOf('card-part', 'name', "What was HyperCard?", sim.stack);
end help

on sampleMessage
answer "The simulator script sees the message" with "end sampleMessage"
end sampleMessage

on myHandler
-- and you can write your own. just type it here
-- or in the script of a part of the stack
put "I'm writing a handler!" into greeting
answer greeting
end myHandler

on FizzBuzz
-- a famous homework problem
get empty
repeat with n=1 to 100
if it is not empty 
then put return after it
if n mod 3 is not 0 and n mod 5 is not zero then
put n after it
next repeat
end if
if n mod 3 is 0 then put Fizz after it
if n mod 5 is 0 then put Buzz after it
end repeat
put it
end fizzbuzz

-- you can also write functions like the square of five or the sqrt(9+9)

function square y
return y times y
end square

function sqrt n
return the abs of n ^0.5
end sqrt

-- You can mix in lines of JavaScript.

function random n
return Math.floor(Math.random()*number(n)) + 1;
end random
function round n
return Math.round(number(n));
end round
function abs n
return Math.abs(number(n));
end abs
function trunc n
return Math.floor(Math.abs(number(n))) * Math.sign(n);
end trunc

function length ofStr
return the number of chars in ofStr
end length

function max
var flattened = Array.from(arguments).map((a)=>(typeof a==='number')?a:String(a).split(',').map(number)).flat();
return Math.max.apply(null, flattened);
end max
function min
var flattened = Array.from(arguments).map((a)=>(typeof a==='number')?a:String(a).split(',').map(number)).flat();
return Math.min.apply(null, flattened);
end min
function sum
var flattened = Array.from(arguments).map((a)=>(typeof a==='number')?a:String(a).split(',').map(number)).flat();
return flattened.reduce((partial,a) => partial+a, 0);
end sum
function average
var flattened = Array.from(arguments).map((a)=>(typeof a==='number')?a:String(a).split(',').map(number)).flat();
return flattened.reduce((partial,a) => partial+a, 0) / flattened.length;
end average

function annuity rate, periods
return (1 - (1 + rate) ^ -periods) / rate
end annuity
function compound rate, periods
return (1 + rate) ^ periods
end compound

function ln value
return Math.log(value);
end ln
function ln1 value
return Math.log1p(value);
end ln1
function log2 value
return Math.log2(value);
end log2
function exp value
return Math.exp(value);
end exp
function exp1 value
return Math.expm1(value);
end exp1
function exp2 value
return 2 ^ value
end exp2

function sin theta
return Math.sin(number(theta));
end sin
function cos theta
return Math.cos(number(theta));
end cos
function tan theta
return Math.tan(number(theta));
end tan
function atan theta
return Math.atan(number(theta));
end atan

function date
return new Date().toLocaleDateString();
end date
function time
return new Date().toLocaleTimeString();
end time
function ticks
return Math.floor(Date.now() / 1000 * 60);
end ticks
function seconds
return Math.floor(Date.now() / 1000);
end seconds
function secs
return the seconds
end secs

function stacksInUse
return empty
end stacksInUse

on put message
window.put_into_messagebox ? put_into_messagebox(message,true) : console.log(message);
end put

function charToNum c
return String(c).codePointAt(0);
end charToNum
function numToChar n
return String.fromCodePoint(n);
end numToChar

-- you can get or set properties
function cursor
return "this is the cursor"
end cursor
on setCursor value
-- put "set the cursor to" && value
end setCursor

function textArrows
return body.classList.contains('arrow-keys-in-text');
end textArrows
on setTextArrows value
body.classList.toggle('arrow-keys-in-text', boolean(value));
end setTextArrows

function itemDelimiter
return sim.itemDelimiter || ',';
end itemDelimiter
on setItemDelimiter newDelimiter
sim.itemDelimiter = newDelimiter;
end setItemDelimiter

function mouseLoc
return sim.mouseLoc || "0,0";
end mouseLoc
function mouseH
return item 1 of the mouseLoc
end mouseH
function mouseV
return item 2 of the mouseLoc
end mouseV
function clickLoc
return sim.clickLoc || "0,0";
end clickLoc
function clickH
return item 1 of the clickLoc
end clickH
function clickV
return item 2 of the clickLoc
end clickV
function clickText
-- this should return the clicked word or group
return empty
end clickText
function clickLine
return sim.clickLine || '';
end clickLine
function mouse
return sim.mouse || 'up';
end mouse
function mouseClick
if (!this.stackOf().mouseClick) return false;
this.stackOf().mouseClick = false;
wait until the mouse is up
return true
end mouseClick

function screenRect
return String([0,0,stackcontainer.offsetWidth,stackcontainer.offsetHeight]);
end screenRect
function shiftKey
return body.classList.contains('shift') ? 'down' : 'up';
end shiftKey
function commandKey
return body.classList.contains('command') ? 'down' : 'up';
end commandKey
function optionKey
return body.classList.contains('option') ? 'down' : 'up';
end optionKey
function sound
return sim.sound || 'done';
end sound
function offset needle, haystack
return String(haystack).toLowerCase().indexOf(String(needle).toLowerCase()) + 1;
end offset

on setPattern what
if what is an integer then
set_gray_pattern('ui-patterns/PAT128_'+(sim.pattern=(what-1))+'.png');
if (window.patternz) { window.patternz.style.setProperty('--pattern-x', Math.floor((what-1)/10)); window.patternz.style.setProperty('--pattern-y', (what-1)%10); }
end if
end setPattern
function pattern
return sim.pattern || 32;
end pattern

on setLineSize value
sim.lineSize = number(value);
end setLineSize
function lineSize
return sim.lineSize || 1;
end lineSize

on setBlindTyping
end setBlindTyping
function blindTyping
return true
end blindTyping

on setNumberFormat
end setNumberFormat
function numberFormat
end numberFormat

on setLockRecent
end setLockRecent
function lockRecent
end lockRecent

on setPowerKeys
end setPowerKeys
function powerKeys
end powerKeys

on setLockScreen
end setLockScreen
function lockScreen
end lockScreen

on setSoundChannel
end setSoundChannel
function soundChannel
end soundChannel

on setUserModify
end setUserModify
function userModify
end userModify

on setUserLevel
end setUserLevel
function userLevel
return 5
end userLevel

on setGrid
end setGrid
function Grid
end Grid
on setDragSpeed
end setDragSpeed
function dragSpeed
return 0
end dragSpeed
on setFilled
end setFilled
function filled
end filled

on setTextFont what
painttext_proxy.textFont = what;
end setTextFont
function textFont
return painttext_proxy.textFont;
end textFont
on setTextSize what
painttext_proxy.textSize = what;
end setTextSize
function textSize
return painttext_proxy.textSize;
end textSize
on setTextHeight what
painttext_proxy.textHeight = what;
end setTextHeight
function textHeight
return painttext_proxy.textHeight;
end textHeight
on setTextAlign what
painttext_proxy.textAlign = what;
end setTextAlign
function textAlign
return painttext_proxy.textAlign;
end textAlign
on setTextStyle what
painttext_proxy.textStyle = what;
end setTextStyle
function textStyle
return painttext_proxy.textStyle;
end textStyle

on setLockMessages value
sim.lockMessages = boolean(value);
end setLockMessages
function lockMessages
return !!sim.lockMessages;
end lockMessages

on setLockErrorDialogs value
end setLockErrorDialogs
function lockErrorDialogs
return false
end lockErrorDialogs

on setEditBkgnd value
if (boolean(value) != sim.stack.classList.contains('background-mode')) body.qs('#background-mode').click();
end setEditBkgnd
function editBkgnd
return sim.stack.classList.contains('background-mode');
end editBkgnd

function windows
end windows
function stacks
end stacks
function menus
return Array.from(this.stackOf().parentNode.menubar.qsa('title-bar-menu')).map((tbm)=>tbm.name).join('\\n');
end menus
function voices
end voices
function suspended
return false
end suspended
function diskSpace
return 2^20
end diskSpace
function heapSpace
return 2^20
end heapSpace
function version
get the shortVersion of the stack
if it is a number then return it
return 2.41
end version
function longVersion
return "0" & (the version * 100) & "8000"
end longVersion
function systemVersion
return 6.08
end systemVersion

on doMenu what
if what contains "New Stack" then
newstack.click();
else if what contains "New Card" then
sim.stack.newCard();
else if what contains "New Background" then
sim.stack.newCard(true);
else if what contains "New Button" then
body.qs('#toolbarvert button-part[name="New Button" i]').click();
else if what contains "New Field" then
body.qs('#toolbarvert button-part[name="New Field" i]').click();
else if what contains "Stack Info" then
launch_info_dialog(sim.stack);
else if what contains "Import Stack" then
importstack.click();
else if what contains "Message" then
if (document.getElementById('messagebox-visible')) document.getElementById('messagebox-visible').click();
else if what contains "Help" then help
else if what contains "first" then go first
else if what contains "prev" then go prev
else if what contains "next" then go next
else if what contains "last" then go last
else if what contains "home" then go home
else if what contains "back" then go back
else
log "doMenu" && what
end if
end doMenu

on select selPart
if (selPart instanceof HTMLElement) { if (sim.stackOf(selPart)===sim.stack) sim.selectOf('#toolbar button-part', '', selPart.matches('field-part') ? 'Field' : 'Button', body).click(); sim.stackOf(selPart).selectedPart = selPart; return; }
if (!String(selPart)) { this.stackOf().focus(); return; }
if word 1 of selPart is "line" and word 2 of selPart is an integer and word 3 of selPart is "of" then do "select" && selPart
end select

on answer _parent, promptText, firstButton, secondButton, thirdButton
-- answer "Answer?" with yes or NO
-- the button choice will be in the variable It
var xtqa = XTalkQueue.Active;
yield (launch_answer_dialog((result)=>{ _parent.it = answerdialog.button_result; xtqa.resume(); }, promptText, firstButton, secondButton, thirdButton), {timeout: 2**32});
end answer

on ask _parent, promptText, initialText
-- ask "Input something?" with "the default text"
-- the user's text will be in the variable It
var xtqa = XTalkQueue.Active;
yield (launch_ask_dialog((result)=>{ _parent.the_result = askdialog.button_result; _parent.it = askdialog.text_result; xtqa.resume(); }, promptText, initialText), {timeout: 2**32});
end ask

on choose it

if it is a number then get item it of "browse,button,field,select,lasso,pencil,brush,eraser,line,spray,rectangle,round rect,bucket,oval,curve,text,regular polygon,polygon"
if last word of it is "tool" then delete last word of it
if it is "rect" then get "rectangle"
if it is "round rectangle" then get "round rect"
if it is "poly" then get "polygon"
if it is "spray can" then get "spray"
if it is "regular poly" or it is "reg poly" or it is "reg polygon" then get "regular polygon"
body.qs('#toolbar button-part[name=\"' + _.it.trim() + '\" i]').click();
end choose

on beep count
if count is empty then put 1 into count
get empty
repeat with x=1 to count
put " c" after it
end repeat
play beep tempo 300 it
end beep

on play first, notes
if (first=='stop') kill_audio(); else perform_classic_play_command(first, notes);
end play

on speak text, voice
window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
end speak
function speech
return window.speechSynthesis.speaking ? 'speaking' : 'done';
end speech

on goToStack target
push_recent_card(sim.card);
if target is "Home" then
go home
exit goToStack
end if
target = String(target).replaceAll(':','/').replaceAll(/[^\\w\\/]/g,'-');
var levels = 0; while (target[levels]=='/') levels++;
if (levels) { var md = this.stackOf().parentNode; target = (md.dataset.user?md.dataset.user+'/':'')+((md.dataset.path||'').split('/').slice(0,-levels).join('/'))+target.substr(levels-1); }
console.log('going to stack ' + tickedString(target));
var userpath = target.split('/');
if (userpath.length > 1) { download_user_stack(userpath.shift(),userpath.join('/')); }
else { download_user_stack('',target); }
end goToStack

on showCards howMany
set the lockMessages to true
if howMany is not an integer then put the number of cards into howMany
repeat howMany
wait 5 ticks
go next card
end repeat
set the lockMessages to false
end showCards

on sendToMe bugReport
var a = document.createElement('a');
a.href = "mailto:dan@hypervariety.com?body=" + encodeURI(bugReport);
a.click();
end sendToMe

function rj_list_icons
return Array.from(JSON.parse(this.stackOf().importedICONResources||'[]')).map((i)=>(i.ID + ' ' + i.name)).join('\\n');
end rj_list_icons

function rj_retrieve_icon id
var icon = JSON.parse(sim.stack.importedICONResources||'[]').find((i)=>i.ID==id);
if (!icon) return '';
return atob(icon.data).split('').map((p)=>[(p=p.charCodeAt(0))&128,p&64,p&32,p&16,p&8,p&4,p&2,p&1]).flat().map((b)=>b?1:0).join('');
end rj_retrieve_icon

on rj_store_icon id, withName, bits
if the length of bits is not 32^2 then return "Icons are 1024 chars long, 0 for white, 1 for black"
var icons = JSON.parse(sim.stack.importedICONResources||'[]'), icon = icons.find((i)=>i.ID==id);
if (!icon) icons.push(icon={ ID:id });
icon.name = withName;
icon.data = "";
for (var b=0; b < bits.length; b += 8) icon.data += String.fromCharCode(((bits[b+0]==0)?0:128)+((bits[b+1]==0)?0:64)+((bits[b+2]==0)?0:32)+((bits[b+3]==0)?0:16)+((bits[b+4]==0)?0:8)+((bits[b+5]==0)?0:4)+((bits[b+6]==0)?0:2)+((bits[b+7]==0)?0:1));
icon.data = btoa(icon.data);
this.stackOf().importedICONResources = JSON.stringify(icons);
delete this.stackOf().importedICONImages;
end rj_store_icon




`;


/* (c) 2022 Hypervariety Custom Software. All rights reserved. */
"use strict";

const ElementTemplate =
{
Created: {},
Create(tag, attributes, inherits, template, helper_function_or_object)
{
inherits = ElementTemplate.Created[inherits];

var elementTemplate = this;
if (this===ElementTemplate)
{
elementTemplate = document.createElement('element-template');
elementTemplate.setAttribute('tag',tag);
elementTemplate.setAttribute('attributes',attributes||'');
elementTemplate.setAttribute('inherits',(inherits && inherits.getAttribute('tag'))||'');

var elementTemplate_template = document.createElement('template');
elementTemplate.appendChild(elementTemplate_template);
if (typeof template == 'string')
elementTemplate_template.innerHTML = template;
else if (template instanceof HTMLElement)
elementTemplate_template.appendChild(template);
else
elementTemplate_template.appendChild(document.createElement('slot'));
}

var thisInherits = inherits, inheritance_chain = [], attributes_chain = attributes, helper_function_chain = [];
while (thisInherits) {
if (thisInherits.getAttribute('attributes'))
attributes_chain = thisInherits.getAttribute('attributes') + ',' + attributes_chain;
inheritance_chain.push(thisInherits);
helper_function_chain.push(thisInherits.getAttribute('tag').split('-').map((s,i)=>/[A-Za-z0-9_]+/.exec(s)).join('_'));
thisInherits = ElementTemplate.Created[thisInherits.getAttribute('inherits')];
}
//console.log(tag, attributes_chain, inheritance_chain, helper_function_chain, helper_function_chain.map((h)=>window[h]));

var inherits_helper_function = null;
if (inherits) {
if (inherits.getAttribute('attributes'))
attributes = inherits.getAttribute('attributes') + ',' + attributes;
inherits_helper_function = inherits.getAttribute('tag').split('-').map((s,i)=>/[A-Za-z0-9_]+/.exec(s)).join('_');
//console.log(attributes);
}

attributes = attributes_chain;	// when this works just replace _chain

var defaults = {}, scan, scanner = /[\s]*([\w|]+)[\s]*([=][\s]*(([\d.-]+)|'(([\\][.]|[^'\\])*)'|"(([\\][.]|[^"\\])*)"|([\w]*))[\s]*)?[,]?/gy;
while (scan=scanner.exec(attributes || '')) {
var synonyms = scan[1].split('|'), prop = {
attribute: synonyms[0],	// the offical getter/setter uses the case sensitive first synonym
symbol: Symbol(synonyms[0]),
value: (scan[5]!==undefined) ? scan[5] : (scan[7]!==undefined) ? scan[7] : (scan[9] && scan[9].toLowerCase()=='true') ? true : (scan[9] && scan[9].toLowerCase()=='false') ? false : (scan[4]!==undefined) ? parseInt(scan[4]) : (scan[9]||'')
};
synonyms.forEach((s)=>(defaults[s.toLowerCase()]=prop));
}
var custom_helper_class = 'HTML'+tag.split('-').map((s)=>s[0].toUpperCase()+s.substr(1).toLowerCase()).join('')+'ElementTemplate';
var custom_helper_function = tag.split('-').map((s,i)=>/[A-Za-z0-9_]+/.exec(s)).join('_');
//console.log(elementTemplate, defaults, elementTemplate_template);
// note: it might be time to just see if this works as a closured real class.
var ceClassScript = `"use strict";
var DynamicHelperSymbol = Symbol('Ø');
return class ${custom_helper_class} extends HTMLElement {
constructor() {
super();
var element = this, et_template = elementTemplate.querySelector('template'), dynamic_helper = null, ready_to_launch_dynamic_helper = false;
if (!et_template) (et_template=document.createElement('template')).content.appendChild(document.createElement('slot'));
element.attachShadow({mode: 'open'}).appendChild(et_template.content.cloneNode(true));	// note that any shadow elements don't seem to be inited yet by this
inheritance_chain.forEach((inherits)=>{
if (inherits.querySelector('template'))
element.shadowRoot.insertBefore(inherits.querySelector('template').content.cloneNode(true), et_template.classList.contains('before') ? null : element.shadowRoot.firstChild);
});
function launchHelper() {
if (!dynamic_helper)
{
if (!ready_to_launch_dynamic_helper) return false;
dynamic_helper = {};	// let it be empty in the meanwhile
dynamic_helper =
((typeof helper_function_or_object==='function') && (helper_function_or_object(element, element.shadowRoot) || {}))
|| ((typeof helper_function_or_object==='object') && helper_function_or_object)
|| ((typeof ${custom_helper_function}==='function') && (${custom_helper_function}(element, element.shadowRoot) || {}))
|| {};
helper_function_chain.forEach((inherits_helper_function)=>{
var inherit_dynamic_helper = (inherits_helper_function in window) && window[inherits_helper_function](element, element.shadowRoot);
if (inherit_dynamic_helper) {	// overwrite the property descriptors. But what of conflict inherit{get} and this{set}?
Object.defineProperties(inherit_dynamic_helper, Object.getOwnPropertyDescriptors(dynamic_helper));
dynamic_helper = inherit_dynamic_helper;
}
});
Reflect.set(element,DynamicHelperSymbol,dynamic_helper);
}
return dynamic_helper;
}
Object.setPrototypeOf(element, new Proxy(${custom_helper_class}.prototype, {
set(target, prop, value, receiver)
{
//console.log('set',{target, prop, value });
if (typeof prop === 'string' && launchHelper()) {
// when the user sets a property that is a watched attribute, we want to set the attribute ourselves and let ACC() do the set.
var ptlc = prop.toLowerCase(), defaultProp = defaults[ptlc];
if (defaultProp) {
prop = defaultProp.attribute;
if (String(value) != String(defaultProp.value)) { element[defaultProp.symbol] = value; element.setAttribute(prop,value); }
else { delete element[defaultProp.symbol]; element.removeAttribute(prop); }
}
else {
var desc = Object.getOwnPropertyDescriptor(dynamic_helper, prop)
|| ((ptlc=Object.getOwnPropertyNames(dynamic_helper).find((p)=>p.toLowerCase()===ptlc)) && Object.getOwnPropertyDescriptor(dynamic_helper, prop=ptlc));
//if (desc) console.log('setting dynamic helper ' + prop);
(desc && desc.set) ? (dynamic_helper[prop]=value) : Reflect.set(...arguments);
}
}
else Reflect.set(...arguments);
return true;
},
get ( target, prop, receiver )
{
//if (prop=='boolean') { console.log('get',{target, prop }); debugger; }
if (typeof prop === 'string' && launchHelper()) {
// we should allow an attribute that calls the helper for the sole reason that it is case insensitive like in hc
var ptlc = prop.toLowerCase(), defaultProp = defaults[ptlc];
if (defaultProp) prop = defaultProp.attribute;
var desc = Object.getOwnPropertyDescriptor(dynamic_helper, prop)
|| ((ptlc=Object.getOwnPropertyNames(dynamic_helper).find((p)=>p.toLowerCase()===ptlc)) && Object.getOwnPropertyDescriptor(dynamic_helper, prop=ptlc));
if (desc && (desc.value || desc.get)) return dynamic_helper[prop];
if (defaultProp)
return (defaultProp.symbol in element) ? element[defaultProp.symbol]
: element.hasAttribute(prop) ? element.getAttribute(prop) : defaultProp.value;
}
var result = Reflect.get(...arguments);
return (result !== 'undefined') ? result : element.hasAttribute(prop) ? element.getAttribute(prop) : undefined;
}
}));
ready_to_launch_dynamic_helper = true;
}
connectedCallback() {
if (!this[DynamicHelperSymbol]) { var trigger = this['']; }
if (typeof this[DynamicHelperSymbol].connected === 'function') (this[DynamicHelperSymbol].connected)();
}
disconnectedCallback() {
if (!this[DynamicHelperSymbol]) { var trigger = this['']; }
if (typeof this[DynamicHelperSymbol].disconnected === 'function') (this[DynamicHelperSymbol].disconnected)();
}
attributeChangedCallback(prop, oldValue, newValue) {
//console.log('attributeChangedCallback',[prop,oldValue,newValue]);
if (!this[DynamicHelperSymbol]) { var trigger = this['']; }
if (!this[DynamicHelperSymbol]) return;
var defaultProp = defaults[prop.toLowerCase()];
if (defaultProp) {
var desc = Object.getOwnPropertyDescriptor(this[DynamicHelperSymbol],defaultProp.attribute);
if (defaultProp.symbol in this) {
//console.log('ACC override',{oldValue,newValue,recent:this[defaultProp.symbol]});
if (newValue===null)
delete this[defaultProp.symbol];
else newValue = this[defaultProp.symbol];
}
// if an attribute has a non-empty default value, does setting it to empty mean the default? No! removing the attribute means the default.
if (desc && desc.set) (this[DynamicHelperSymbol])[defaultProp.attribute] = (newValue!==null) ? newValue : defaultProp.value;
}
}
static get observedAttributes() { return Object.keys(defaults); }
}`;
customElements.define(tag, (Function('elementTemplate,tag,defaults,helper_function_or_object,inherits,inheritance_chain,helper_function_chain', ceClassScript))(elementTemplate,tag,defaults,helper_function_or_object,inherits,inheritance_chain,helper_function_chain));
ElementTemplate.Created[tag] = elementTemplate;
//console.log(elementTemplate);
return elementTemplate;
}
};

customElements.define('element-template', class HTMLElementTemplateElement extends HTMLElement {
connectedCallback()
{ ElementTemplate.Create.call(this, this.getAttribute('tag'), this.getAttribute('attributes'), this.getAttribute('inherits')); }
});

/* (c) 2022 Hypervariety Custom Software. All rights reserved. */
"use strict";

const ContentEditableFix = {
div_forms_observers: new Map(),
DOMContentLoaded_listener: null,

ActiveElement()
{
var el = document.activeElement;
if (el.shadowRoot && el.shadowRoot.activeElement)
return el.shadowRoot.activeElement;
if (el.slot && el.assignedSlot)
return el.assignedSlot.closest('field-part');
return el;
},
ClosestEditable(element)
{
if (element && !element.closest) element=element.parentNode;
var ce = element && element.closest && element.closest('[contenteditable]');
return (ce && ce.isContentEditable) ? ce : null;
},
InnerText(element)
{
var it = Array.from(element.childNodes);
it = it.map((e)=>(e.assignedNodes && e.assignedNodes()[0]) || e);
it = it.map((e)=>{
if (e.nodeName=='BR') return '\n';
if (e.nodeValue!==null) return e.nodeValue.trim() || ' ';
var tc = e.textContent || e.innerText;
return tc + ((tc.substr(-1)=='\n') ? '' : '\n');
});
it = it.join('');
if (it[it.length-1]=='\n') it = it.substr(0,it.length-1);
return it;
},
HTMLEncode(text)
{
return String(text).replaceAll(/&/g,'&amp;').replaceAll(/</g,'&lt;');
},
Detach(element)
{
var observer = this.div_forms_observers.get(element);
if (observer)
{ observer.disconnect(); this.div_forms_observers.delete(element); }
},
Attach(element)
{
var observer = new MutationObserver(div_form_observer);
observer.callback = div_form_observer;
observer.observe(element, { childList: true, attributes: true, subtree: true });
this.div_forms_observers.set(element,observer);
div_form_observer([]);

element.FixCENow = (debug)=> {	// usually call this first thing in oninput because the mutation observer hasn't yet run
observer.takeRecords();
if (debug) debugger;
div_form_observer([]);
};

function is_cleartext(node)
{ return node && node.nodeType===3 && !node.nodeValue.trim(); }
function is_realtext(node)
{ return node && node.nodeType===3 && !!node.nodeValue.trim(); }
function div_form_observer(m)
{
if (document.readyState == 'loading' && !element.nextSibling)
{
if (!ContentEditableFix.DOMContentLoaded_listener)
{
document.addEventListener('DOMContentLoaded',ContentEditableFix.DOMContentLoaded_listener=(event)=>
{
document.removeEventListener('DOMContentLoaded',ContentEditableFix.DOMContentLoaded_listener);

ContentEditableFix.div_forms_observers.forEach((observer)=>{
if (observer.awaiting_DOMContentLoaded)
{ observer.awaiting_DOMContentLoaded = false; observer.callback(observer.takeRecords()); }
});
}, true);
}
observer.awaiting_DOMContentLoaded = true;
}
else
{
var sel, shadowRange;
if (document.activeElement && document.activeElement.shadowRoot && (sel=document.activeElement.shadowRoot.getSelection()) && sel.rangeCount && (shadowRange=sel.getRangeAt(0)))
{
sel = { anchorNode: shadowRange.startContainer, anchorOffset: shadowRange.startOffset, focusNode: shadowRange.endContainer, focusOffset: shadowRange.endOffset };
}
else
{
sel = getSelection();	// this isn't working for shadow roots
sel = { anchorNode: sel.anchorNode, anchorOffset: sel.anchorOffset, focusNode: sel.focusNode, focusOffset: sel.focusOffset };
}

if (sel.anchorNode instanceof HTMLElement)
{ sel.anchorNode = sel.anchorNode.childNodes[sel.anchorOffset]; sel.anchorOffset = 0; }
if (sel.focusNode instanceof HTMLElement) {
//sel.focusNode = sel.focusNode.childNodes[sel.focusOffset];
if (sel.focusNode.childNodes[sel.focusOffset]) { sel.focusNode = sel.focusNode.childNodes[sel.focusOffset]; sel.focusOffset = 0; }
//else { sel.focusNode = element; sel.focusOffset = -1; }
}

var examine = element.firstChild;
if (!examine)
element.appendChild(examine=document.createElement('br'));

var removeThis = null;
do {
if (removeThis)
{ element.removeChild(removeThis); removeThis = null; }
if (is_cleartext(examine))
{ removeThis = examine; continue; }
if (!(examine instanceof HTMLDivElement)) {
var examineNext = examine, ateBR = false;
element.insertBefore((examine=document.createElement('div')), examineNext);
do {
var examineNextSibling = examineNext.nextSibling;
examine.appendChild(examineNext);
ateBR = (examineNext instanceof HTMLBRElement)
examineNext = examineNextSibling;
} while (!ateBR && examineNext && !(examineNext instanceof HTMLDivElement));
}
while (examine.lastChild instanceof Text && examine.lastChild.nodeValue.trim().length==0)
examine.removeChild(examine.lastChild);

// dump everything after the first BR
examine.removeAttribute('style');
var firstBR = examine.firstChild;
while (firstBR && !(firstBR instanceof HTMLBRElement)) {
if (firstBR.nodeType === 1 && element.classList.contains('script-indent')) {
if ((getComputedStyle(firstBR).display||'').indexOf('inline')!=-1) {	// move span, B, etc children to first level
var husk = firstBR;
console.log('unwrapping inline ', husk.outerHTML);
while (husk.lastChild)
examine.insertBefore((firstBR=husk.lastChild), husk.nextSibling);
examine.removeChild(husk);
}
else break;	// stop here
//else firstBR = firstBR.nextSibling;
}
else
firstBR = firstBR.nextSibling;
}
if (firstBR) { 	// move everything else to after examine
while (examine.lastChild && examine.lastChild !== firstBR)
element.insertBefore(examine.lastChild, examine.nextSibling);
if (firstBR && !(firstBR instanceof HTMLBRElement))
{ console.log('pushing down ', firstBR); /*element.insertBefore(firstBR, examine.nextSibling);*/ }
}
else if (!is_realtext(examine.lastChild)
&& !(examine.lastChild instanceof HTMLSpanElement && is_realtext(examine.lastChild.lastChild)))
{
examine.appendChild(document.createElement('br'));
}
}
while (examine=examine.nextSibling);

if (sel && element.contains(sel.anchorNode))
{
if (!shadowRange || ShadowRoot.prototype.getSelection)
getSelection().setBaseAndExtent(sel.anchorNode, sel.anchorOffset, sel.focusNode,
(sel.focusOffset==-1) ? sel.focusNode.childNodes.length : sel.focusOffset);
else {
// tricky, but i guess it can be done, must find current sel and adjust until we're there
//console.log('emitting contains selanchornode for shadow');

//getSelection().modify('move','forward','character');
}
}
}
}
},
GetRichContentsOfRange(range)
{
var result = { html: "", text: "" };
var startText = (range.startContainer.nodeType === 3) && range.startContainer;
var endText = (range.endContainer.nodeType === 3) && range.endContainer;

catalog_siblings(startText || range.startContainer.childNodes[range.startOffset], true);
return result;
function catalog_siblings(node, follow_all)
{
var over = false;
while (node && !over)
{
if (node === endText) {
append((node === startText)
? node.nodeValue.substring(range.startOffset, range.endOffset)
: node.nodeValue.substr(0,range.endOffset));
over = true;
}
else if ((node === range.endContainer && range.endOffset === 0) || node===range.endContainer.childNodes[range.endOffset])
over = true;
else if (node.nodeType === 3)
append(node.nodeValue.substr((node === startText) ? range.startOffset : 0));
else if (node.nodeType === 1) {
var pair = tag(node);
result.html += pair.open;
if (pair.close) {
over = catalog_siblings(node.firstChild);
result.html += pair.close;
}
else if (node.nodeName.toLowerCase()=='br')
result.text += '\n';
}
while (!over && follow_all && !node.nextSibling) {
node = node.parentNode;
if ((node === document.body) || (node === range.endContainer && range.endOffset === node.childNodes.length))
over = true;
else {
var pair = tag(node);
result.html = pair.open + result.html + pair.close;
}
}
node = node && node.nextSibling;
}
return over;

function append(text) {
result.text += text;
result.html += text.replaceAll(/&/g,'&amp;').replaceAll(/</g,'&lt;');
}
function tag(node)
{
var name = node.nodeName.toLowerCase(), out = "<"+name, hasCloseTag = ['area','base','br','col','command','embed','hr','img','input','keygen','link','meta','param','source','track','wbr'].indexOf(name)==-1;
if (node.className)
attr('class',node.className);
if (name=='img' && node.src)
attr('src',node.src);
if (hasCloseTag) {
// THIS needs the whitelist! Or we need to write a generate_faux_from_node without children, and then generate_html_header_from_faux.
// We can't duplicate everything here.
if (customElements.get(name)) {
(customElements.get(name).observedAttributes || []).forEach((a)=>{
var v = node.getAttribute(a);
if (v !== null)
attr(a,v);
});
}
}
out += ">";
function attr(a,v) { out += " "+a+(v.length ? "=\""+node.getAttribute(a).replaceAll(/&/g, '&amp;').replaceAll(/"/g, '&quot;')+"\"" : ''); }
return { open: out, close: (hasCloseTag ? "</" + name + ">" : null) };
}
}
}
}


// this has issues pasting inside a modal dialog, and may need to confect their own oninput events
function copycutordrag(event)
{
if (['INPUT','TEXTAREA'].includes(document.activeElement.nodeName.toUpperCase()))
return;

var contents, selpart = (document.activeElement && document.activeElement.nodeName.toLowerCase()==='stack-part' && document.activeElement.selectedPart), selrange;
if (selpart) {
selrange = new Range();
selrange.selectNode(selpart);
contents = ContentEditableFix.GetRichContentsOfRange(selrange);
}
else if (getSelection().type == 'Range') {
contents = ContentEditableFix.GetRichContentsOfRange(getSelection().getRangeAt(0));
}
else return;

console.log('copied ' + contents.html);
if (!document.random_nonce)
document.random_nonce = String(Math.random());
if (event.type == 'dragstart') {
event.dataTransfer.setData("text/html", contents.html);
event.dataTransfer.setData("text/plain", contents.text);
event.dataTransfer.setData("text/nonce", document.random_nonce);
//document.qs('button-part[name=upon]').style.outline = 'auto';
}
else {
event.clipboardData.setData("text/html", contents.html);
event.clipboardData.setData("text/plain", contents.text);
event.clipboardData.setData("text/nonce", document.random_nonce);
if (event.type=='cut' && !selpart)
{ document.execCommand('delete'); }
else if (event.type=='cut') {
if (closest_editable_container(selpart)) {
getSelection().addRange(selrange);
closest_editable_container(selpart).focus();
getSelection().collapseToStart();
}
selpart.parentNode.removeChild(selpart);
document.activeElement.selectedPart = null;
}
event.preventDefault();
return false;
}
}
document.addEventListener('copy', copycutordrag);
document.addEventListener('cut', copycutordrag);
document.addEventListener('dragstart', (event)=>{
if (event.composedPath()[0].getAttribute && event.composedPath()[0].getAttribute('draggable') == "false") event.preventDefault();
else return copycutordrag(event);
});
document.addEventListener('paste', (event)=>{
if (document.activeElement.nodeName.toUpperCase() != 'DIV' && document.activeElement !== body && document.activeElement !== body_focus_proxy)
return;

/*if (['INPUT','TEXTAREA'].includes(document.activeElement.nodeName.toUpperCase()))
return;*/

console.log('running content-editable-fix paste');

if (event.clipboardData.getData('text/html')) {
var spanner = document.createElement('span');
spanner.innerHTML = event.clipboardData.getData('text/html');
if (ContentEditableFix.ActiveElement() && ContentEditableFix.ActiveElement().matches('field-part.script-indent'))
spanner.innerText = spanner.innerText.split('\n').map((t)=>t.trim()).join('\n');
console.log('pasting ' + spanner.innerHTML);
// we have a mutation watching thing with tree diff, but it's incomplete; you paste a span and it lives inside one of the line divs

/*var start = NBU2.RegisterAction(()=>{
},()=>{NBU2.Redo(end);});*/

if (sim.stack.contains(ContentEditableFix.ActiveElement()) || ContentEditableFix.ActiveElement() === body || ContentEditableFix.ActiveElement() === body_focus_proxy) {
var part = spanner.firstElementChild;
if (part && ['button-part','field-part'].includes(part.nodeName.toLowerCase())) {
console.log(part);
sim.stack.currentLayer.appendChild(part);
part.topLeft = part.topLeft || "200,100";
//part.width = part.width || part.offsetWidth;
//part.height = part.height || part.offsetHeight;
body.qs('#toolbar button-part[name="' + part.nodeName.split('-')[0] + '" i]').click();
sim.stack.selectedPart = part;
}
}
else {
function strip_locations_and_styles(node)
{
node.childNodes.forEach((e)=>{
if (e.nodeType!==1) return;
if (['button-part','field-part'].includes(e.nodeName.toLowerCase()))
e.topLeft = e.width = e.height = '';
if (e.style) delete e.style;
strip_locations_and_styles(e);
});
}
strip_locations_and_styles(spanner);
/*	spanner.childNodes.forEach((e)=>{
if (e.nodeName && ['button-part','field-part'].includes(e.nodeName.toLowerCase()))
e.rect = '';
});*/
getSelection().getRangeAt(0).deleteContents();
var range = getSelection().getRangeAt(0);
range.insertNode(spanner);
getSelection().selectAllChildren(spanner);
getSelection().collapseToEnd();
}

/*var end = NBU2.RegisterAction(()=>{NBU2.Undo(start);},()=>{
getSelection().getRangeAt(0).deleteContents();
var range = getSelection().getRangeAt(0);
range.insertNode(test);
getSelection().selectAllChildren(test);
});*/

event.target.dispatchEvent(new Event('input', { bubbles: true }));
event.stopPropagation();
return event.preventDefault();
}
});

// https://github.com/GoogleChromeLabs/shadow-selection-polyfill/blob/master/demo.html
// POLYFILL
//https://jsfiddle.net/dbalcomb/oLnkyv78/
const SUPPORTS_SHADOW_SELECTION = typeof window.ShadowRoot.prototype.getSelection === 'function';
const SUPPORTS_BEFORE_INPUT = typeof window.InputEvent.prototype.getTargetRanges === 'function';
const IS_FIREFOX = window.navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

class ShadowSelection {
constructor() {
this._ranges = [];
}

getRangeAt(index) {
return this._ranges[index];
}

addRange(range) {
this._ranges.push(range);
}

removeAllRanges() {
this._ranges = [];
}

// todo: implement remaining `Selection` methods and properties.
}

function getActiveElement() {
let active = document.activeElement;

while (true) {
if (active && active.shadowRoot && active.shadowRoot.activeElement) {
active = active.shadowRoot.activeElement;
} else {
break;
}
}

return active;
}

if (IS_FIREFOX && !SUPPORTS_SHADOW_SELECTION) {
window.ShadowRoot.prototype.getSelection = function() {
return document.getSelection();
}
}

if (!IS_FIREFOX && !SUPPORTS_SHADOW_SELECTION && SUPPORTS_BEFORE_INPUT) {
let processing = false;
let selection = new ShadowSelection();

window.ShadowRoot.prototype.getSelection = function() {
return selection;
}

window.addEventListener('selectionchange', () => {
if (!processing) {
processing = true;

const active = getActiveElement();

if (active && (active.getAttribute('contenteditable') === 'true')) {
document.execCommand('indent');
} else {
selection.removeAllRanges();
}

processing = false;
}
}, true);

window.addEventListener('beforeinput', (event) => {
if (processing) {
const ranges = event.getTargetRanges();
const range = ranges[0];

const newRange = new Range();

newRange.setStart(range.startContainer, range.startOffset);
newRange.setEnd(range.endContainer, range.endOffset);

selection.removeAllRanges();
selection.addRange(newRange);

event.preventDefault();
event.stopImmediatePropagation();
}
}, true);

window.addEventListener('selectstart', (event) => {
selection.removeAllRanges();
}, true);
}
"use strict";

if (!Object.getOwnPropertyDescriptor(window,'body'))
Object.defineProperty(window, 'body', { get() { return document.body; } });

[HTMLElement,HTMLDocument,ShadowRoot,DocumentFragment].forEach((p)=>{
p.prototype.qs = p.prototype.querySelector;
p.prototype.qsa = p.prototype.querySelectorAll;
});

/*HTMLElement.prototype.qs = HTMLDocument.prototype.qs = ShadowRoot.prototype.qs = DocumentFragment.prototype.qs = function(selector) { return this.querySelector(...arguments); }
HTMLElement.prototype.qsa = HTMLDocument.prototype.qsa = ShadowRoot.prototype.qsa = DocumentFragment.prototype.qsa = function(selector) { return this.querySelectorAll(...arguments); }*/

String.prototype.includedBy = function(s){ return String(s).includes(this); }

// can we make all shadow content pointer-events: none during contextmenu? probably, with a css variable --context-menu-none
document.addEventListener('contextmenu', ()=>(body && body.classList.add('contextmenu')), true);
document.addEventListener('mousemove', ()=>setTimeout(()=>body && body.classList.remove('contextmenu'),0));	// when does contextmenu disappear exactly?

function follow_mouse(event, move_func, gate_func, always_end) {
var movename = (event.type=='simulateddown') ? 'simulatedmove' : (event.type=='pointerdown') ? 'pointermove' : ('ontouchmove' in document) ? 'touchmove' : 'mousemove';
var endname = (event.type=='simulateddown') ? 'simulatedup' : (event.type=='pointerdown') ? 'pointerup' : ('ontouchend' in document) ? 'touchend' : 'mouseup';
var endname2 = (event.type=='pointerdown') && 'pointercancel';

document.addEventListener(movename, move);
document.addEventListener(endname, end);
if (endname2) document.addEventListener(endname2, end);
document.addEventListener('contextmenu', context);
var has_begun, has_cancelled;
move(event);
function move(event) {
if (event.clientX===undefined && event.touches && event.touches[0])
{ event.clientX = event.touches[0].clientX; event.clientY = event.touches[0].clientY; }
if (!has_begun && gate_func && !(has_begun=gate_func(event,true))) return;
if (move_func) move_func(event);
}
function end(event) {
if (event.type == 'simulatedup')
move(event);
//console.log('folllow_mouse end', event);
document.removeEventListener(movename,move);
document.removeEventListener(endname,end);
if (endname2) document.removeEventListener(endname2, end);
setTimeout(()=>{ document.removeEventListener('contextmenu',context); }, 1);
if (has_begun && !has_cancelled && gate_func) gate_func(event,false);
else if (always_end || has_cancelled) gate_func(event, 'cancel');
}
function context(event) {
console.log('contextmenu');
has_cancelled = true; has_begun = false; //if (has_begun) return;
end(event);
}
}

function mutableStyle(property, value)
{
var style = document.qs('style#mutable-style');
if (!style) {
document.head.appendChild(style=document.createElement('style'));
style.id = 'mutable-style';
style.innerHTML = "body { }";
}
style.sheet.cssRules[0].style.setProperty(property,value);
}

function better_emit_json_as_html(json, level=0, noWhitespaceLevel=2)
{
var keys = Object.keys(json), tag = json.$.toLowerCase(), levelTabs = "\t".repeat((level<noWhitespaceLevel) ? level : 0);
var top = "<" + tag + keys.map((a)=>{
if (a=='$' || a=='$$') return '';
var value = String(json[a]);
if (value=='' || /[^\w,.]/.test(value)) return " " + a + "='" + value.replaceAll(/&(?=[\w])/g,'&amp;').replaceAll("'","&apos;").replaceAll("\\","\\\\") + "'";
return ' ' + a + '=' + value + '';
}).join('') + ">";
if (["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"].includes(tag))
return levelTabs + top;
var middle = (json.$$||[]).map((n)=>(typeof n==='string') ? cleanStr(n) : better_emit_json_as_html(n,level+1,noWhitespaceLevel));
var bottom = "</"+tag+">";
if ((json.$$||[]).length > 2 || ((json.$$||[]).length && tag.substr(-5)=='-part'))
return levelTabs + top + ((level<noWhitespaceLevel)?"\n":"") + middle.map((l)=>l.split('\n').map((l)=>levelTabs+l).join('\n')).join(((level<noWhitespaceLevel)?"\n":"")) + levelTabs + ((level<noWhitespaceLevel)?"\n":"") + bottom;
return levelTabs + top + middle.join('') + bottom;

function cleanStr(n)
{
var out = n.replaceAll(/[ \n\r\t]+/g, ' ').replaceAll(/&(?=[\w])/g,'&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
//console.log(n,out);
return out;
}
}

// is problem with backslashes??
function emit_json_as_html(json, level=0, noWhitespaceLevel=2)
{
var keys = Object.keys(json), tag = json.$.toLowerCase(), levelTabs = "\t".repeat((level<noWhitespaceLevel) ? level : 0);
var top = "<" + tag + keys.map((a)=>{
if (a=='$' || a=='$$') return '';
var value = String(json[a]);
if (value=='' || /[^\w,.]/.test(value)) value = "'" + value.replaceAll(/&(?=[\w])/g,'&amp;').replaceAll("'","&apos;").replaceAll("\\","\\\\") + "'";
return ' ' + a + '=' + value;
}).join('') + ">";
if (["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"].includes(tag))
return levelTabs + top;
var middle = (json.$$||[]).map((n)=>(typeof n==='string') ? n.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') : emit_json_as_html(n,0,0));
var bottom = "</"+tag+">";
if ((json.$$||[]).length > 2 || ((json.$$||[]).length && tag.substr(-5)=='-part'))
return levelTabs + top + ((level<noWhitespaceLevel)?"\n":"") + middle.map((l)=>l.split('\n').map((l)=>"\t".repeat(level+1)+l).join('\n')).join(((level<noWhitespaceLevel)?"\n":"")) + "\t".repeat(level) + ((level<noWhitespaceLevel)?"\n":"") + bottom;
return levelTabs + top + middle.join('') + bottom;
}

var audio_context, built_in_sounds;
function check_audio()
{
if (audio_context)
return;
audio_context = new (window.AudioContext || window.webkitAudioContext || function(){})({ latencyHint: 'interactive' });
built_in_sounds = {
beep: loadBase64Sound("data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+ Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNKIeoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2oCgILEBupZgHvAhEBcZ6joQBxS76AgccrFlczBvKLC0QI2cBoCFvfTDAo7eoOQInqDPBtvrDEZBNYN5xwNwxQRfw8ZQ5wQVLvO8OYU+mHvFLlDh05Mdg7BT6YrRPpCBznMB2r//xKJjyyOh+cImr2/4doscwD6neZjuZR4AgAABYAAAABy1xcdQtxYBYYZdifkUDgzzXaXn98Z0oi9ILU5mBjFANmRwlVJ3/6jYDAmxaiDG3/6xjQQCCKkRb/6kg/wW+kSJ5//rLobkLSiKmqP/0ikJuDaSaSf/6JiLYLEYnW/+kXg1WRVJL/9EmQ1YZIsv/6Qzwy5qk7/+tEU0nkls3/zIUMPKNX/6yZLf+kFgAfgGyLFAUwY//uQZAUABcd5UiNPVXAAAApAAAAAE0VZQKw9ISAAACgAAAAAVQIygIElVrFkBS+Jhi+EAuu+lKAkYUEIsmEAEoMeDmCETMvfSHTGkF5RWH7kz/ESHWPAq/kcCRhqBtMdokPdM7vil7RG98A2sc7zO6ZvTdM7pmOUAZTnJW+NXxqmd41dqJ6mLTXxrPpnV8avaIf5SvL7pndPvPpndJR9Kuu8fePvuiuhorgWjp7Mf/PRjxcFCPDkW31srioCExivv9lcwKEaHsf/7ow2Fl1T/9RkXgEhYElAoCLFtMArxwivDJJ+bR1HTKJdlEoTELCIqgEwVGSQ+hIm0NbK8WXcTEI0UPoa2NbG4y2K00JEWbZavJXkYaqo9CRHS55FcZTjKEk3NKoCYUnSQ 0rWxrZbFKbKIhOKPZe1cJKzZSaQrIyULHDZmV5K4xySsDRKWOruanGtjLJXFEmwaIbDLX0hIPBUQPVFVkQkDoUNfSoDgQGKPekoxeGzA4DUvnn4bxzcZrtJyipKfPNy5w+9lnXwgqsiyHNeSVpemw4bWb9psYeq//uQZBoABQt4yMVxYAIAAAkQoAAAHvYpL5m6AAgAACXDAAAAD59jblTirQe9upFsmZbpMudy7Lz1X1DYsxOOSWpfPqNX2WqktK0DMvuGwlbNj44TleLPQ+Gsfb+GOWOKJoIrWb3cIMeeON6lz2umTqMXV8Mj30yWPpjoSa9ujK8SyeJP5y5mOW1D6hvLepeveEAEDo0mgCRClOEgANv3B9a6fikgUSu/DmAMATrGx7nng5p5iimPNZsfQLYB2sDLIkzRKZOHGAaUyDcpFBSLG9MCQALgAIgQs2YunOszLSAyQYPVC2YdGGeHD2dTdJk1pAHGAWDjnkcLKFymS3RQZTInzySoBwMG0QueC3gMsCEYxUqlrcxK6k1LQQcsmyYeQPdC2YfuGPASCBkcVMQQqpVJshui1tkXQJQV0OXGAZMXSOEEBRirXbVRQW7ugq7IM7rPWSZyDlM3IuNEkxzCOJ0ny2ThNkyRai1b6ev//3dzNGzNb//4uAvHT5sURcZCFcuKLhOFs8mLAAEAt4UWAAIABAAAAAB4qbHo0tIjVkUU//uQZAwABfSFz3ZqQAAAAAngwAAAE1HjMp2qAAAAACZDgAAAD5UkTE1UgZEUExqYynN1qZvqIOREEFmBcJQkwdxiFtw0qEOkGYfRDifBui9MQg4QAHAqWtAWHoCxu1Yf4VfWLPIM2mHDFsbQEVGwyqQoQcwnfHeIkNt9YnkiaS1oizycqJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7 FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb//////////////////////////// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU="),
harpsichord: loadBase64Sound("data:audio/wav;base64,UklGRrQUAABXQVZFZm10IBAAAAABAAEAjEUAAO9WAAABAAgAZGF0YZAUAACAgICAgICAgICAgICAgICAgICAgIODe4GAgIB9fXt0c3FzeYCFh4iOjY6QkpKQkJCQkI6Ni4qIhXl3e3dvZ2dnZGBdWFhVVlNVYmlxcWpmZmZpaWRpbHBpZ3F3i5SVmqSsq6asuLu/v8XPzMrCv8XAu7axtq6YkIWFfHdnXVJPRT85P0hLT0M1NDQ3Lyw3Pz47NzpNXWRiboCGiIWLmqisrLrDx8K6uMPFw7+/v7Snl4uDgXlzZ2BdVk1ITVZfXVBGRUlGPEFLVVNYVVhzfoWInKe1r7W4yNDN0Nfe49nMz8/SysXFwrOmkoV7d25iU01DOSwsLzE3LSIbGBsOEBkiIyoqLz9SX2JygZCVmKGsuL3AyNTX18/P0tLU0M3Qx7msoZWOhnxxZl9VS0VJSVBLQTk0NCwnLDk7Oz8/TltscX6Nnaapr7jIz83S3uPq39nc3N7V0NbUxbikmI6IfG9dXFBEMjExNTUqHRQUEAQADhMUGhYgMUFNU2V2iI6VnKy5v8LM1N7h2tnc4ePc3uHc0MWzp6SckIB2b2VVS0hITUY5LCgnIBQWICQoKCgyRFVfZ3iJl52krr3FzNHZ5e3o4ePk6uTj4+PXz7uuoZyShW9nXVI+NzE0MiwYDgkHAAAAAwYJCxAfL0FJWGl+hpKXqbO/w9DX5urk5uju8O3u8evk0sW4s6uhj4F3bFtNRkVGPzYlHhsTBwkQERgYHSM0RFNbbICNl56quMPK0tnm7u3q6O7w7ert6+TVxbSpopqGdmxkUUE3MTQvKhYOCQQAAAAAAwMGBxkpPENVZXmGjperuMLK0Nzr8O3q7vP18fHz8ejZyLmzrKGKfndsWE0+QUE/MSMbGhEEBgkOExYWHy1BTVdneIqVnKa0wsrP1+Xu8Ovq7vHw7e3t5NvKuqykmot5bGRVRDYxMTEpGRALBwAAAAEDBwkLGSc8RlNieIaSlaexwMfN1+jr7urt8fPw8PPw69zPu7Wsoo2Bd2xbTkVBQUE0KB4dEwsJCxAUFhYeKkBJVWJ2g4+Vn6y6wsfN2+To5OPo6+rm6Ojk28y7rKefj3x0al1NPjk5OzQnGxgRBwEEBwsQEBEbLDxEUmJzgoqQnam2vcPM2uHj4OHo6ujo6urm2c+7ta6nk4iAdGlYTUtNT0M3Li4iGRQWGh4gHSIqPkZSW255iIuVn6y2uL7N1NrX0tfe3tzc4NzVzLuspqKVhXxxaVtNRkVIRDotKiIYERARFBgYGB4sOUROW2t7gYaSnauxtsDM1dnU1tzg3uDj4+Hay762sayakoiBc2VaVlhYU0Q8Ny0jHR0dIiIgICc3P0lSYGx7foaOnaarr73Hz83KzdbW1tfc2tfPvbOrq5qSiIF2bF1TU1VVSj43MSUdGhobHR0bHik1PkZSX252fIWPnaKps73HzcrM0tnZ2d7g4d7Rw7u4s6aakouBdGdiYmZfUEhFOS8lJCIlJCIeIzE5Q0lVYnFze4GQmJ6ir7bDw8LDzM/P0NbZ19DCuLGvpJySi4F3aWBcX2BWSUM6MSUiHSAiIh0dJS83P0pWZG50e4WSmJ6nsb3Fw8PMz9LU19ze3NTFvbu0q6GYk4t+cWppbmldU01DNy8oKCgqJSInLzc+RE5aZ2xxd4WOkpiiq7a4uLnCxcfKz9LS0MO4s7GpoZWSioNzamZpbGRWUkk/NS8qKi4qJSQsMjxDS1VkanB0foiQlZqksLi2tr7DxcnN0NTWz8K5uLSspJ6XkoV7cXF0dGddWk5EOjQxMTEtJyoyOT5ETVhkaWpve4WKjpWhq66rsba5vcDDyszMwraxsayknJiSi352cHN2cWRfVk1DOzU0NDQsKi81PD9IUF1kaWp0foWKjpikrKurs7i7v8PKzdDNwru4trGpop+YkIV7eX5+dGplW1BGPzs5OzQuLjE3PD9GUlpgYmVvdn6BiJKcoaGkrK+ztr3Dx8rCuLW1sauioZyYjYN9foOBdHBnXVBIQT4+PDIvMTQ7PkNJVV1iYGpxeX2BiJWfoaGprLG1ucDFysrAubi2s6yopJ+YkIODiIp+d3NpXVJJQ0FBOjIxMTU7PENLU1pcX2dudHd+iJKYmp2iqayvtr3DycK5tbWzrqikoZyViIOFioZ+d3FkWk5IQ0NBOTQ0NTs+Q0ZSWl9dZGpzdnuBjZWamqGkq66zub/Hx8C4uLW1rKmmop6ViIeLjYV+d3FkWk9JRUU/OTQ1OTw/Q0tTWlxdZGlxdHeAi5KUl5yipqmvtbvCwLixsbGsqKSin5qPh4iNi4V+d29kWFBNS0lDPDs8PkFDSVBYXF1gZ25xdnmFi5CSl5yhpKyvtr3CvbWxsbGrqKain5iLio6QjYiBe29lWlNPT0lDPj4/QUNGTVNcXFxfZ2pwcXmBioqOkpiaoaars7m5s66urqyopqSin5WLjZKSjoiFe29lXVZTUk1EQUFDRUZJUFhcXF1gZ2xwc3uDiIqNkpeaoaastLu2r66urquoqKikn5KQlZiXko2Ie3RnYFhYU01FRUVFRkhLUFhYWFpgZGlpb3d+gYOIjpCYnKKns7Wuq6urqKikpKSknJKSl5qXko6Ge3FnYFxaVk1ISEhIS0tQVlhYWF1gZ2lqcXuAgIOKjZKYnaKss7Osq6urq6moqKikmJSYnJyYlJCFe29nYF9aU0tISEhJS01SWFhYWF1gZmZqcXl9fYGIipKVnKKssaypqamoqKSkpKSclZSYmpqVlIuBdm5kYF9aUktJSElLS1BVWFhYWl9kZmdudn1+gIWKjZWYn6evr6ypq6moqKamqKSalJecnpqXk4qAdGxmYmBYUE1LS0tLTVJYWFhYXF1iYmdudHl5foOFi5CVnKarqaaopqSkpKKkpp+VlZienpqYkot+dmxpZmRaVVJPUFBPU1pdXFxcX2RmZmpxd3l7foOFi5CUnaaopqSkpKSioaKkopyVl5yenpyYkoh+c25qaWJaVlNSUlJSVlxdXFxcX2JiZGpxc3R3fX2FiIuSnKKin5+fnp6enqGkn5iVmJ6enp6YkoZ+dHBubGRdWlhYVlVWXV9fX19fYmJkZm5zc3Z7fX6FiIuVnKGfnp6enp6enqGinJWVmp6hn5yYkIV7dHFwaWJdWlhYVVVaXV9dXFxdYF9iZWxwcHR3eX6BhYuTnJ6cnJyanJ6an6KinJeYn6GhoZ6YjoZ7dnNzamRfXVxcWFhdYmJfX19iYmJiam5wcHR2eX6BhY6VnpyampqanJqcn6Kfl5ecnqGhn5yTi4J3dHNuZ2BdXFxYVlpdX19dXF9fX19iamxucXR2e36DhpCYmpqampqcnJqeoqKcl5ieoaSioZqSiH55dnRuZ2JfX1xaWl1iYmJfX2BiYGBnbGxuc3N3e4CBiJKamJeXl5eal5ieoZ+VlZqeoaGhn5iQhX55dnFsZ2JfX11cXWBiZGBfYmJiX2JpbGxuc3R2e36BipOXlZeVlJeXl5ien5qUlZqeoaGhnZWNg315d3NuaWZkYl9fZGZpZWJiYmRiYmdqbGxwcHN2e32BipKUlJSQkJSUkpecnJSQlZieoaGhmpWIgX19d3RsaWZmYmBiZmlpZmZmZmZiZmpsbHBwcXN3eX2DjZCQkJCQkJKQlJial5KSl5yeoaGfmJKIgX17d3NuamlnZGJmZ2xqZmZmZmRiZ2ppbGxwcHR2eXuFjY6QkI2NkI6OkpqalJCVl5yfoaGfmI6IgIB9eXNwbGlnZGZnbGxpZmZmZGJiZ2lpbGxwcHN2dnyIi42NjY2NjY2OlZqYlJSVmJ+ipKKfl46Fg4F+eXNwbGxnZmdqbGppZ2ZmYmBkZmdpaWxsbnNzdn6HioqNiouNi4uQmJiVlJSXnJ+kpKKflYuHg4F+d3RwcGxpaWlucGppaWlmYmJmaWlpbGxscHNzd4GHioqKiouLiouSl5WSkJSYnKGipKGYkoiFg4B8dnRwbmppaWxwbmxpaWlnYmRpaWlsbGxucXN0fIOIioqKioqKio2UlZKQkJWYnKGioZ+XjYeFg355dnNzbmxpanBwcGxsamlmZGdpaWlsbGxwcXB0foGHh4eHh4eHh46SkpCNkJSXnp+hoZyTioeDg357dnZzcGxscXNzcHBsbGpmZ2lsbGxsbG5xcHF3foOHh4eHh4eDho6QkI2NkJSYnqGhn5iQioeHgX55dnZzcGxuc3NzcHBwbGdmaWlpamxsbG5wcHF7foODg4ODg4OBiI6QjYqNkJWanqGhn5eNiIeHgX55eXZ0cXBzdnZ0cXBwbGdpamxqbGxsbHBubnN7foGDg4ODg4CBiI6Oi4qOkpecn6GhnJOLioiHg359e3l0cXF2dnZ0cHBwamZpamlpamlpbGxsbnR7foCAgICAgH2Fio2NioqOkpicoaKhnJKLioqHg359fXl0c3Z5eXl0c3NwamlsbGxsbGlsbGxscXZ7foCAgICAfX6Fi42KiouOk5icn6Gel46KioeFfn19eXdzc3Z5eXdzc3FuaWpsbGxsbGxsbGxudHd+gICAgIB+fYGIjYuKio2OlZqeoaGckouKh4eDgH19e3ZzdHl5eXZ2dnFsaWxsbGxsbGxwbGxxdHt+gICAgIB9fYGKioqHiouQlZqeoZ6VjoqIh4WAfX19d3Rzdnl7d3Z2dHFsbGxubG5sbG5ubG5xd3t+gH5+gH57fYOKioeHio2Sl5qfoZyVjoqKiIWAgIB9eXZ3e319d3d5dnBsbnBsbm5sbG5sbG5xd3t9fX19fXl3e4OHh4OHh4uSlZqenpiSi4qKh4OAgIB9eXZ5fYB9eXl5dHFwcHBwcHBscHBsbHB0eX19fX19e3d3foWHhYOHiI6Sl5yenJWOioqIhYOAgIB9eXl7gIB9fX13dHFwcXBwcG5scGxsbHB0d3t7eXl7d3R3gIODg4OFio6UmJ6emJSLioqKhYOAg4B9eXuAg4B9fX13dHBzcXBwcGxwcGxsbnF2e315eXt5dHR5gYODg4OFi46UmJ6cl5CKioqIg4OBg4B7eXyAgX59fXt3cXFzcHBwbmxwbGxsbnN3e3l5e313c3d+gYODg4OIi5CVnJ6alY2KioqHg4CDgX55eX6DgH59fnt2c3Nzc3NxcHBwbmxscXR5fXl5fXt2c3l+g4ODgYWIjZKYnJyYkIqKiIeDgYCDgHt5e4CBgH19fXl0c3Nzc3NwcHBwbGxuc3d7e3l7fXdzdHuBg4GAgYeLjpKYnJqTjYqKiIeDgIODgHt5foODgICAfndzc3Nzc3NwcHBubGxwc3d5eXl5eXRzdHuAgICAgYWKjZKYmpiOioeHh4OBgYODfn1+gYODgYODfnd2dnZ2dnNxc3FwbG5xdHl5eXl5d3Nzd3yAgH5+gYWKjpWYmpONiIeHh4GAg4OBfX2AhYWDg4OBfHl2dnZ2dnNzc3NwcHBzd3l5d3l5dHFxd31+fX1+gYeIjpSXl46Kh4eFg4CAg4OAfX2Bh4WDg4WBe3l2dnZ2c3Nzc3FwcHF0eXl5eXl3dHB0e36AfX2AhYeLkpWalY6Ih4eHg4CBg4N+fX6Fh4ODg4N+eXd2dnZ0c3NzcW5sbnF0d3Z2eXl0cXF0e359fX6BhYiOkpiako6KiIeHg4ODh4N+foGHh4ODh4N+eXd2eXdzc3NzcHBwcHN3eXZ3eXd0cHF3e319fX6BhYiOlZiVjouIh4eFgYGDg4F9foGHhYOFhYF9eXZ2eXZzc3NzcHBwcXR5d3Z5eXdxcHR3fX19fX6DhYqOlZeSjYiHh4eDgIOFg4B+gYeHhYWHh4B+enp6end3d3d0c3JydHh6eHh6enZycnZ6fn56foCBh4mRlJSNiIeFhYGAgIODgX5+gYaGg4SGhIB8e3t7e3h4eHh1c3J0dnt7e3t7eXVzdHh8fnx7foCBhouQlJCLh4SGhIGAgYSDf36AhIaGhIaGg4B8e35+e3h4eHd2dHN2ent7e3t7eXR0dnp9fXt7f3+ChouOkIyHhIKCgYCAgYKBf3+BhoaEhoiEgn99fX99e3t7enl3d3V4fHx8fH18eHV2eH1/fXx9f4CChouPjYqFgoKCgICAgoKBf3+ChYWFhoaDgX9/f398fHx8enl4dXh6fHx6fHx7d3Z3eXx8fHx9f4GDiIyOi4iFgoKCgYCBhYOAgIGFhYWGh4aDgH9/f398fHx6enh4dnh7fHt7fHx5d3d4enx8fHx/f4GDh4uLiYWDgoKCgICDhIGAgIKEhISGhoSDf39/f359fX17enl3eHp9fHt8fXx4dnh4fH19fX1/gIGFiIqJh4SCgoKAf4CCgoB/gYOEhIWGhoSBf39/f399fX19fHt6e319fX1/fnx5eHh8fX19fX5/gIGEh4iHhIKAgIB/f3+CgX9/gIOEg4ODg4KAgICAgH9+fn59fHt7fX9/fn+Af3x6eXt9fn5+foCAgIKFh4eFgoGBgICAgIGBgICAgYODg4OEg4GAgICAgH5+fn59fXx8fX5+fn+AfXx6enx+fn5+foCAgIKFhoWDgYCAgICAgIGAgICAgoODg4SEg4GAgICAgICAfn59fHx9fn9+f4B/fnt7e35/f39/f4CAgYOEhYOCgYCAgICAgIGAgICAgoKCgoODgYCAgICAgICAf39+fX1/f39/gIB/fXx8fX5/fn5+f4CAgIOEhIOBgICAgICAgIGAgICBgoKCg4ODgYCAgICAgICAgH9/f39/f39/gH9/fn19fn9/f39/f4CAgYKDg4GAgICAgICAgYCAgICBgYGBgoKBgICAgICAgICAgH9/f3+AgICAgIB/fn5+f39/f3+AgICAgYKCgoCAgICAgICAgICAgICAgYGBgYGBgICAgICAgICAgICAgICAgICAgICAf3+AgICAgICAgICAgYGBgYCAgICAgICAgICAgICAgYGBgYGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=="),
flute: loadBase64Sound("data:audio/wav;base64,UklGRiQIAABXQVZFZm10IBAAAAABAAEAi0UAAO5WAAABAAgAZGF0YQAIAACBgYGBgYGAgICAgICAgICAgICAgH9+fn5+fn5+fn5+fn9/f4CAgICAgICBgoKDg4ODg4ODg4ODg4OCgoKBgYCAgH9/fn59fXx8fHt7e3t7fHx8fXx9fn5/gICBgYKDhISFhYaGhoaGh4eHhoWFhIOCgYCAf359fXx7enp5eHd3d3d4eHl5ent8fX5/gIGCg4SFh4iIiYqKioqKiomJiIeGhYSDgYCAfn17enl4d3Z1dXV1dXV1dnd4eXp7fH5/gIKDhYaIiYqLjIyNjY2MjI2Mi4mIhoWDgYB/fXt6eHd1dHNzcnFxcXFyc3R1d3h6fH6AgYOFh4mLjI6Pj5CRkZGQj4+PjYuJh4WDgYB9e3h2dHJxb25tbWtrbGxub3FydHd5e36Ag4aIi42PkZSVlpeXl5eWlZSTkY+MiYaDgH57eHRxb21raWdnZmZlZmdoam1vcnV4e3+ChYmMj5KVl5qcnZ6enp2cmpiWlJGOioeCf3t4dHBsaWZkYmFgX19fYGJkZmlscHR4fICEiIyQlJebnaCjpKWlpKOhn52al5OPioaBfXl0cGtnY2BdXFpZWVlaWl1fYmZqbnR4foKHjJGVmp6hpKerrKysq6qopaKemZWQioWAenVvamVfXFhVU1JRUVJTVFdaXmNobnN5f4SLkZedoqaqrbCytLS0srCuqqahm5aQiYN9d3BpY15YVFBNS0lJSUpMT1BVWmBmbXR7gYiPl56kqa6ytbi6vLy7ubezrqmjnZaQiIF5cWliXFZQS0hEQkFBQkNGSU5TWWBnbnV9hI2UnKKprrO3u72/v7+9u7izrqminJSNhX51bmdgWVNOSkZDQkFBQkRHS1BWXGJpcXiBiJCXnqWrsLW5vL6/v769uraxrKagmZGKgXpya2RdV1FMSEVCQUFBQ0ZJTVJYXmVsdHyEi5Oaoaets7e6vb+/v767uLSvqqSdlo6Gf3dvaGFaVE9KR0RCQUFCREdLT1RaYWhweH+HjpadpKqwtbi8vr+/vr26t7Ktp6GZkouDfHRsZV5XUk1JRUNBQUFDRUhMUVddZGxze4KKkZmgp62ytrq9vr+/vry5tbCrpZ6Xj4iAeHFpYltVUEtHREJBQUJDRkpOU1pgZ292foWNlJyjqa+0uLu9v7+/vbu3s66oopuUjIR9dW1mX1lTTklGQ0FBQUJESEtQVlxjanJ5gYiRmJ+mrLG1uby+v7++vLm2saymn5iRiYF6cmpjXFZRTEhEQkFBQUNGSU5TWV9mbXV8hIyUm6KorrO3u72/v7++u7i0r6mjnJWOhn52b2dgWlRPSkZDQkFBQkRHS1BVW2JpcHiAiI+XnqSqsLW5vL6/v769urayraegmZKKgntzbGReV1FMSEVDQUFBQ0VJTVJXXmRsdHyDi5KZoKetsre6vb6/v768uLWwqqSelo6Hf3hwaWJbVE9LR0RCQUFCREdKT1RaYGhvd3+GjpWcpKqvtLi7vr+/v726t7OuqKKak4uEfHVtZl5YUk1JRkNBQUFCRUhMUVZdZGtyeoGJkZigpqyxtrm8vr+/vry5tbGspZ6XkIiBeXJpYlxWUEtIREJBQUJDRklOU1lgZ251fYSMlJyiqa6zt7u9v7+/vbu4tK6popyUjYV+dW5nYFlTTkpGQ0JBQUJER0tQVlxiaXF4gIiQl56lq7C1uby+v7++vbq2saymoJmRioJ6cmtkXVdRTEhFQkFBQUNFSU1SWF5lbHR8hIuTmqGnrbK3ur2/v7++vLi0r6qknZaOhn93b2hhWlRPSkdEQkFBQkRHS09UWmFob3h/h46WnaSqsLW4vL6/v7+9ureyraehmpKLg3x0bWZfWFNOSkdEQ0JDREdKTlJYXmVtdHuCiZCXnqWrr7S3uru8vLu5trKuqaOdlo6HgHlya2ReWFNPS0hGRUVGR0pNUlZcYmlwd36FjJOaoaasr7O2uLm6ubi2sq+qpZ+YkouEfnZwaWJdWFNPTEpISEhJS05RVVtgZ210eoCHjpWcoqerrrK0tre3trSyr6umoZuVjoiBe3RtaGJdWFRQTkxLSktMT1FVWl9kanB3fYOKkZedoqerr7GztLS0s7Gvq6einZeRi4V/eHJsZmFcWFVRT05NTU5PUlVZXmJobXN6gIaMkpidoqerrq+xsrKxsK6rp6OemZSOiIF8dnBqZWFdWFVTUVBQUFFTVlldYWZrcXZ9goiOk5meoqaqra+ur6+uraqnpJ+blpGKhYB6dG9qZV9cWFVTUlFRUlNVWVxgZGludHp/hImPlJmdoaWoqqurq6upqKajn5uXkYyHgn55dG9qZWJgXVtZWFdYWFpcYGNmam9zeH2AhYqOk5eanaCipKWmpaSjoZ+cmZaRjYmEgH14dHBsaWVkYmBfXl5fX2FjZWlscHN3e3+ChoqNkJOWmJqcnZ6enJybmZeVko+MiYWCf3x4dXJvbWtpamhoZ2doaWpsbXFzdXh7fYCDhoiKjY+RkpSVlpaWlpSTkpCOjIqIhYOAf3x6eHZ0c3FwcHBvb29wcXFzdHZ4ent9f4GChIaIiYqLjI2Njo6OjoyLiomIh4aEg4GAf318e3l4d3Z2dXZ2dnZ2d3h4eXp8fX5/gIGCg4SFhYWGh4eHh4eHh4aFhYSEg4KBgYCAf39+fn19fHx8e319fX19fX1+fn5/gICAgICAgYGBgYGBgYGBgYGBgYGAgICAgICAgICAgICAgICAgICAgA=="),
boing: loadBase64Sound("data:audio/wav;base64,UklGRjQeAABXQVZFZm10IBAAAAABAAEAjEUAAO9WAAABAAgAZGF0YRAeAACAgICAgICAgICAgICAgICAgICAgICAgYOIkKK9cT84OjhYeoiqs6+rqot4cF5FR1BKUnJ/iaOvp6enjndvYkxOV1logouTpq6mnpqFcmpgU1RlZ3KDkJCVk3VYRm/O1N7TnXxSOyQzNkZ0laS10868tZx7X1c8NEhXZX+mrr3JvKiXhV5PSEBAUmZ0k6awsrerlYNyXEtKSE1gdISVqKuqp5iDdWdVTVRYY3SGk6OutLS8rVMoJhkrUnOLs77Aw7+aiXpdQkVEQVJueIyosrC1sJuBel1KS01PXHuFlqiyq6eji3xvYU9PWl5vgIuOm5Z6YVGVys7LwYBsSi0uPD9RiaCsvtPFtK6Ja1xRNzdUXHGRq7G+ybWckHlbTkk+Rlxvfpitr7S0o41/aVFLTEtVan2LoKqqqaSQe29fUVBVXGl+jpmnsa2ssqRbKyAbKFFxia/EwsfJnot2YT07PTlNaX2LrLq0t7GcfXRYRUVLTFt7i5uutrGpood0Z1tMTVlfcIKNlJ6Zel5mr8bGwqtyXUUqNUlNY5GkrMDGs6effl5ZTz9HXml8nq2wu76jkYNrU09MRVJreYehrqyuqJKAdV9NT1NVY3mIkqWpop+Xg3NpW1RXXWZxh5Gdp6qnoqaacTQgHyVObY+ux8fKx6CJc189Ojw8UGiAjq68t7ewnH1xV0NBSFBffo+grrmzqaKGdWNZTEtWX22Cj5admIJkbbC7v7ScdVlKMz9QWnKYpqy7vaibknZcV1BIUWhzhKCrrLSxmoh6ZFNRTk5fdYKQoqmmpaCHe2tfUFNaXnCAjZWjpZyYjH1tZ1pXXmdwe42TnaOhnZiWk3lDKiYrT2qPrMbJycSjinBdPzs+QVJpg5Kvu7i1rpiAbFlEQ0lSYHyQobC2sqmeiXNiV01MWGJzhJOZnpiCaXCqtritlnNbTDpGV2J4m6eruLeimIxzW1hSTlhseISiqqquqpiBe2FUUlRVYXiBk6GnpKGbg3ZpXVFVXmN2g5CWoqKWk4Z7amRbWmFqdYCPlZyhnJaSjo6DTzcuMUtjg6G6w8XArY93YU0/QUROZXyPo7a3s6ubgm9cS0NKU2B3jZ2qs7GonYx3ZlpSUFljcoKQmZuYhG5wo7W1q5Z0XE49QFZgeZSprba5opaJeFpYUk1ZanuHoaysraiWgHhfU1JVVmN7hJSjqaWgl4J1Z1pSVl9leIaTmaKilZCDeGhiXFtha3OAjpecoJ2UjYmHiWhENjhEXn6Ys8HBu6+Ue2dUQkJIUWJ7jZ6uuLKqnYhxYVFISlRhdYqaprCwp5uNemtcVVBUYmx/i5ealYtxa5uxtK6ae19RQUFXX3eOp6m0uKeai3xfWlRQV2h4hJ6pq6yomYN7YlZTVldheIGRoKekoZqIeGteVlddZHKDjpegoZqSiHtuZV9aYGhxfY2Vm5+clY6Hg4R1Uz89QlZzj6e6v7qwn4FtWktDRk5bcYaXprGxrKCSd2pZTklQX2qCkaGprqudk4BxYlpTVV9qeISSlpWOd22UsLawoIZmVkQ+UFlvhKKptLmtoJGEZltVTlFgcX+TpquurqCOgG1cVFRSXG19ipqkp6Wfj31wYldUWV1sfYqTn6OfmI6AcWhfWlxja3iHkpmfnZiRioOBf2FHQEBLYoSVsbu7taeSdmhTSEhNV2N/i5+qsKujmX9wYFVMTVtkeoiZoauroZeIemhhVlReZnN9jJKTkHtvi621sKWOcFtLQUtXZn6Zpa24sqKWh3BeV1BPXGx6jqGoqq2kkoNzYFZVU1hpeIWWoaSkoZOCdWhZVVldaXqHkJqhnpqRhHhsZFxcZGl2g4+XnJ6alIyFgIdzVUA/QVV5jKm6vbuxoH5xXE1ESVFadYWYprSyp6GLemVaS0pVXXCAlp6qrqaek4JxZFtUV2BqdoWRlJWMfH+hraefjXNdU0ZOXGp8l6SrsrCgk4VxYFpVVF9xfYyfpqeooI6AdGNYWVldbX2Glp+joZySfnVnXVdbYmp8h5GYnZyUjoB2amVeX2dtfIWSmJublI6HgX+GhmVFPj9Ia4Oet8C/ua2FdV5PQURMVW6ElKSytq2klHppW05HUV1qfpShqbCqoJKCbl9ZUlVhbXuKlpyclIR8kJ2YkYZxYVxVW2x5hpmlpaOfkYJ5bmJfYWVwfImSnaGalo+Ecm1iXWJpcnqKkJOZlo+HgHFqZWRianZ9iZGVlZONgHpybGdpbHB8gYmOkpGOioF9eHl/iZ2EXUpCQlt5kKq6uLOpj3VkVkdIU1tshJSfrLClmYx2ZFtTTlhodYaao6iqoZKFdmZbW11hb32KlZ6elo5+cnmIh4SBfHFwcnJ9gYmNlJGKioF6d3dxcXd6foOKio2NhoKAfXR0dHJ4fYCBiYmFhYN/enl2cXV3eH2BhYaIhYJ/fXh2dnd4en+AgYWDgoKAfXx8fH+DjJaknG9PQTpGZoKgt7y4sJh7Z1VIRU1abYWYo62vopOEb1xRUFFgdISUpKunoZmCdGZdV11pcoSRnaChmYqAcmtrcHV4gIaKjZKPi4h/enZzcnV6f4aLj4yKhn96dnNydXh9g4iLi4mDf3p2cnJzdnqAhomLiYN/enZycHN3fYGGiYqJhYF9eHV1dXh8gIOGiomGg4CAgIOMn6qAUTotNleBpcTNxrSSbVI8MjpPaYKjsry5o490XklFS1V0h5+stK2cjXJiVlJZZn+NoKmpoZCCbmRcX298iouNkZOSjYZ8dGxrcHN+h5CSlJCEf3NsaGxweYOLkJGMhn12cG5vc3uBh4yMiIR9d3Jycnd9gYaIiISBfXh2dnh7gIaIioeDfnh2dXZ6gIaLjIqGg4KChJKrnlw/KitQerDN28qniEsxJytPcqG3ysWjiWFIOj9VcJiqubmji21bS05kdZOlsKyejHFhVFRldo6eqaibjXZnW1dgcoibp6qdinVjWFppfI+fpJ+PfWlbWWFzhZWfnJKBcWVgZXB/jpeYkYN1amVoc4CMk5KMgHVraW13hI6Tko2Ad29rcXeEipGRiIB0b290gomSlpaTmZpnQi8xWIbF2de6eE8mJThhn8DWyJhxQC41ToKjwsSoil1IQE11kLG7sZp6XU9SZoScrKubgWpcXGl+lKKdkoV2amVteomWmpWIeW1nbXiFkpeShXltZ2t1hI2SjYR6cW9zeoOIiYR9d3Nzd3+FiYiBfHZzdHl/g4eGgX96eXp9gIKCgn99fHx/f4KCgIB/f3+AgoWFh4yUhmRNTmmHuMCojV1CP1WBmrWylnJWS1VxkKaklHtjWV10ipqflYBtY2d0hpSZkoR1bWx2gouQjIN6c3R6gomRlIh7cm90go2SjoR8dHR8hYuLiIJ4c3R7gYaLiH97d3Z7f4OFgX16ent9gYKAf3t6enx/gIB/fHx8fH+AgIB/fHx8fX+AgH9/fHx8f4CAgIB/f3+AgYOGiot7ZGFwgpWmmHxjXWd2ipiTg3JqcHqDiYeAdnN5f4OFgXt3d3yDh4aCe3d4fYOIhoJ8eXh8gYODgHt3dnmImZiIcmxqdI+cl4h0cHR+kJSMf3JweoKMkId+dHR8gomIgXt2d36DhYN9enh5f4KCgHx6enx/gIB/fHp8f4CAf318fH1/gH99e3p8f4GCgX99fHx/gIKCg4WKhXFmcH+MmJSAa2Ftf42Ri31va3SCi4yEe3RzeoKIhn95eHl+g4eDf3p6fYGFhYF9enp9gIKBfXp4eHp7hZWUhG1qb3qUnpGAbm56hJKShXpydoKIi4h8d3d8h4qGgHl4e3+GhoB8enp9gYKBfXp7fX+Bf317enx/gYB+e3p7fYCAgH17e3x9gICAf3x8fX+AgICAgIGDhoh7bG15h5OVhnJkanuKko9/dGxygIiLhnp1dXqEiIV/eXd6f4WFgX17fH+ChIJ+fHt9gIKAf3t6e3t9fYSRlYhvaGx4lJ2TgW9ueoWUkoJ2cnaAio6IfHV2foWIhn95eH2DhYR/enl8gIODf3x5fH+Bgn99e3t+gIKAfnx7fX+AgH9+fX1+f4B/f359f3+AgIB/f4CAgoOGhHVscXyMlpCAa2ZxfY6Th3xubnmCjYuAeXN1foWIhHx4eHyDhoWBfHl8f4SEgX97e36AgoF+fHp6e3yBkJqQeGRicIugn4x2Zml7j5mQgXJtd4WPj4V6c3R9iIyHfnd1eoGHh4F7d3h+goaCfnp5e3+Bgn98ent+f4CAfnt7fH6AgH9+e3t9f4CAf359fX9/gICAf39/g4SAd3J1gIqSjH1zbXF/iI6KfndxdH6Giol+eXV4foSIhn98eXp9g4WFgX57e36BgoKAfXt7fH5/fXp4fIucmoRqWl13laamj3JhYXOLnZ6Qe2tmdIaUmI5+cWx0gYySi391b3J9hoyLgHlyc3uCiYmCfHRzeX6FhoN+eHd6foOEg397eXp8gIODgX58e3x/gYSCgH59fX+BgoJ+e3t+goWFg3x6eXp+goSEgH17e31/goKBf359fX5/goKBf399fX+AgICAf399fX1+fn18enh2dXuKoaWUeV5QWnSTra+ghWlZXGuHmaWfiXlmY3B8kJiVjHxybG97hIyOh4F3c3N3f4OIh4N+eHZ4en+ChISBfnp4eXx/gYSCf357ent9gIKCgn9+fHt9f4CCgYB/fnx9foCCgoF/fnt7e36Ag4SDgX58e3t+gIOEg4F+fHt8foCCgoGAf399fX5/f3+AgH9/fHp6eXh4dnZ4iJ6tqpF4VUlMXoegub2pkWtXSVBsg6OwsKOHclpUXGmElqWmmIhwYlpebn2Rmp2WhXhnYmRrfIaSlpKKfXFpZ2x2gYuQkYuCd29tbnR9hIuNi4R+eHNzdXl+hIaFf36DhoaEf3p1c3V5foSKi4qFgHl1dHV5f4SHiYaDf3x5eHp6foGEhYWEgH97enp8fH1/fn18d3Vzc4KXqq2ikXBdTU1fcpCks7OnlnlnWFZcaYGQo6iknIh4ZV5aYXJ/jZuenJKEdWhhYGdzgI2WmZaNgHVrZWVsdYCKkpSSioF4b2pqcHiAiY6Sj4qCenRwcHR4foOIiYaCgYOEgoB9eXd2d3x+hIaJiYaEf3x5eHh6fH+ChIWFhIN/fnt5eHl8foGDhIWEgn98eHV0c3R1d3uDkqappJh+bVhRVF50hJumrKqgkH9tYVpcZHKCkZ2jo5yQgXNmX19jbnyJlZudmI6CdmpkZGdueYOOlJaUjoR7cWpmaG53gIiPk5KPh352b2trbXR6g4qQkZCLg352dHFxcnR6foaLjpCMiIF8dXBwcXZ6goaLjYyKhIB5dnRzdHh8f4aHioqHhH57eHV1dnl7foGCgn98fIKMk5SPhXpwaGZpcHqEj5SXlZCIf3dwbGxvdX2FjJGSkYyGf3dxbW5xdn2Ei4+RjomCfXdzcHBzeH2EiY2NjIiBfXh0cnN2eX+DiYuMioaDfHl1dHZ4fYGGiYyNjIuCeW1pZWhze4iQl5qWkIN9cGtnaG1zf4aPlJWTjIR8dW9sbHB1foSMkJKQi4R/eHNwb3J3fYKGioqJiYuKhn96c29ucXZ+hIuPkY6Jg312cnFxdXp/hYmNjYqFgH12c3JzdnuAhYqLioeCf3h2cnR2eoCCh4iJh4KAe3h2dnd6f4CEhoaGhIB/e3l3eXp9gISGiIiHhoWGg3xuZ2NkbnqHk5qdmpCFeG1kYmRrdYKMk5iWkYh+c2toZ210foiQlZWSi4J6c25tb3R8hIqPkY+KhIB9eXZ1dnl+goiLjo2KhX96dXR1d36Bh4uMi4eDfXh1c3V3foCHiYuJhYB7eHV1dnh/gIWHiIaEgHt5dnZ5eoCChoeHhoKAe3p4eHt9gIKFhoWEgH98e3t+gISIjY+GeGtkYWh1gpCZnZmRg3drY2NocX2HkJWWkYd9c2tpanB6g4yTlJGKgnpybm9ze4CKjpCPioR9eXV1dXZ7gIeNkZGMhnx2cG9yeIGHjpCOioF7dHFxdHuAiI2Oi4R/eHRyc3l+hIiKioaBe3dzc3d7gYaJioeCfnl2dXZ7f4SIiYeDf3x4d3d6foKFiIaFgH17e3x/hIuQjn5waGRndIORmpyWjHtvZWJncn+MlZaSiYBybGhpdH2Ij5ORiYJ3cW5ud36HjZCPiIJ5dXN1e4CGh4aFg4KAgH19fX2AgIOEg4KAf318fX6AgIODgYB+fXt7fH6AgIGBgIB9fXt9fYCAgICAf359fX1/gICAgIB/fn5+gICAgYGAgH9+fn5/gICBgYGAgH9+f4CAgoSGiImBdnBsbXiCkJaWkIJ3aWVqcYKMlJWNhHZuaWt1foqQkY6Ce3FvcXaBiI6PiYR7dXNzeoCGioqHgn9+fn19fn+Ag4SFhIKAfXx8fYCChISEgoB9fX1+gIGCg4KAf319fn+AgYGAgH59fX1/gIGBgYB/fXx8fX+AgYGBgIB+fX1+f4CAgICAgH5+foCAgICAgICAgICAgYOEg355dnZ6f4aLi4iAe3NydXqCiIyLhX93dHR3foKIi4eCfXh1dnx/hYiIhYB8eXh5fICDhIJ/fH2Bh4qIgnt0cXR8hIyQjod+dnJzeoGJjo6JgXp1c3d+hImMiYN9d3R2eoCFiIiEf3t3d3p+goWGhIB9eHh6fICDhYSCf3t5eXt/gISEg4B9fHt7fYCDhIOCgH59fX6AgoODgH17e3yAgoSFg4B9e3l6fYCDhYSDgH17e3t9gIOEhIKAfXx7fH6AgoSDgX99e3t8fX+AgICAhoyNioJ4cG1weoSOlJOMgndwbnN8hY+SkYl/d3FxdXuGi4+Nhn93cnJ2foKJi4mFfnl1dXh8goeJiIJ/eHZ2eH2AhYeFg397eHd6fICEhoWDgHx7ent9gIOEhIOAf3x8fH1/gIKDg4OAgH18fH1+gIKDg4KAgH18fH1/gIKDg4KAf318fH1/gIGCgYB/fXx8fHx9fX1+gYaOkI2GfHJsa298hZGWlJCDe3Btb3R/h5GTkYuAenFvcneBho2QjId+eXJydHmAhouMiYV+eXRzdXmAhYiLh4V+enV1d3qAg4eIh4OAe3l4eHt+g4aHhoSBfnt5eXt9gIGCg4SFhIKAfnt5eXt+gIOFhoWDgHx6eXl7foCDhYWDgX98enp7fYCBgoOCgX99enl5eXt8f4CIj5GRioN3cGlqcXmFjpWXkoyAeXBtb3N8goyQkY+IgXlzcHB0eoGGjY6LiIB7dHFxdHuAhYmLioaBfHd0dHZ6f4OIiYiGgn96d3d3e3+BhIeIhoKAfXt5eXt+gIKDhIOBfXx+gIKDhIKAf3x8fHx+gIGDhISDgYB+fXx8fX+AgYKDg4KAgH99fX19fn+AgICAfn18enx+hYuPj4yHfXZwbnB0fIKLjpGQi4Z/eXNycnV7gIeLjY2LhoF8d3NzdHh+goaJi4mGgX56dXV1eHyAg4aIh4WCf3x5dnZ4e36BhIaHhoSBf3x6eXl7fYCChYaGhYOAfnx6ent8f4CBg4SEhIOBgH59fHx8fX+AgoOEg4KBgH59fX19fn+AgYKCgoGAgH9+fn19fX5/f4CAgIOGiYmHhX98d3V1dnp/g4eKi4qHg397eHZ2eHt/goaIiYiGgn97eXd3eHt/gYSGiIaEgX98eXh4eXt+gYOFhoWDgX98enl5ent+gIKEhYWDgX99e3p6e31/gYOFhYWDgYCAgH17eHh3eH2AhYeKioiFgH55d3Z2eHuAgoWHiIeEgn58eXh4eXx+gYSGh4aFg4B9e3p6e31/gIOFhoaFg4F+fHt6e3x+gYOEhoWEg4B/fHt7e31/gIKEhYSDgX99fHt7fH5/gYKEhIOBgH59e3t8fH6AgYKDg4GAf359fH19fn+AgYKCgYGAf35+fX5+f4CBgoKDgoKCg4OAfXh2dXV6foOHiouJh4F+eXZ1dXd8f4OHiIiGg398eXd3eXx/goWGh4aEgX99e3t8foGDg4KAgICAgIGCgYGAgH9/f4CAgIGBgYGAgIB/f39/gICAgICAgICAf39/f4CAgICAgICAgH9/f39/gICAgYGAgIB/f39/f4CAgIGBgYCAgH9/f39/gICBgYGBgICAgICAgoSFhH96d3V1eH2BhomLiYWBfHd0dHd7f4SHiYiEgXx4d3d5fYCDh4iHhIF+fHp6fX+DhYeGg4F9e3p7fX+DhYeHhIJ+fHl5fH6Bg4aGhIJ/fXp6e32AgoSFg4J/fXp6e32AgoSFg4J/fnt7e32AgYOEg4KAfnx8fH6AgYKDgoKAf319fX+AgYKCgoB/f35+f4CAgoKCgoKCgoJ/e3h3eHt/hIeJiIWBfHd1dnp/g4aIhoN/end3eX2BhIaGhIJ+fHp6fH+ChYaFg4F/fX19fn5/gYSFhYSBf3x7fH2AgoWFhIJ/fHt8fX+ChIWDgX98fHx9gIGDg4KAfn18fX+AgYKCgH9+fX1+f4GCgoKAf319fX+AgYKCgYB/fn5+f4CCgoKAf39+f3+AgYKCgYCAgICBgH99fHx+gIOFhYSBfnt6en1/g4SEg399enp7foGDhISBf317fH2AgoSEgoB/fX19f4CCgoKCgoB/fn5+f4GDg4OBf35+fn+AgoOCgX9/fn5/gIGCgoGAfn5+f4CBgYGBgH9+fn+AgIGBgICAf39/gICBgICAgH9/gICAgYCAgIB/gICAgIGAgICAgICAgICBgICAgICAgIGAgH9+foCAgYKCgYB+fn5+gIGCgoGAf35+foCBgYKBgIB+fn6AgIGBgYCAf35/f4CAgYGDg4GAf3x8fH+ChIWEgX98fHx/gYSFhIF/fX1+f4GDg4KAf359fn+BgoOCgH9+fX5/gYGCgYB/fn5+f4CBgYGAf39/f4CAgYGBgIB/f3+AgIGBgYCAf3+AgICBgYGAgICAgICAgYCAgH9/gICAgYGAgH9/f3+AgIGBgICAf3+AgICBgYCAgIB/gICAgICAgIB/f39/gICBgoOCgH99fHx/gYOFhIKAfnx8foCDhISDgX99fX5/gYOEgoF/fX1+f4CCgoKAgH99fX+AgYKCgYB/fn5/gICBgYGAgH9/f3+AgYGBgIB/f39/gICBgYCAgH9/f4CAgIGBgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYKDgoB/fXx8foCChIWEgX99fHx+gIKEhIOBgH19fX6AgYODgoB/fn19foCBgoKCgH9+fn5+gICCgoGAf39/f3+AgIGCgYCAf39/f4CAgYKBgIB/f39/gICAgYGAgIB/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGCg4KBgH59fH1+gIKEhYSBgH59fX1/gIKDhIOBgH59fX5/gIKDg4KAgH59fX6AgIGCgoGAgH5+fn6AgIGCgoGAgH9+fn+AgICBgYGAgH9/f3+AgICBgYGAgIB/f4CAgICBgYGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgoKCgYB/fn19foCAgoODgoGAf35+fn+AgYKDgoKAgH9+fn+AgIGCgoKAgH9/fn9/gICBgYKBgIB/f39/f4CAgYGBgYCAf39/f3+AgIGBgYCAgH9/f3+AgICBgYGAgICAgICAgICBgYCAgICAgICAgICBgYGAgICAgICAgICAgYGBgICAgICAgICAgICBgICAgICAgICAgICBgYGBgIB/f39/gICBgoKBgICAf39/gICAgYGBgYCAgH9/f4CAgIGBgYGAgICAf4CAgICBgYGAgICAgICAgICAgYGAgICAgICAgICAgIGBgICAgICAgICAgICBgICAgICAgICAgYGAgH9/f3+AgIGCgoGBgIB/f39/gICBgYGBgICAf39/gICAgYGBgYCAgICAgICAgIGBgYGBgICAgICAgICAgYGBgYCAgICAgICAgYGBgYCAgICAgICAgIGBgICAgICAgICAgIGBgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBgYGAgH9/f39/gICBgoKBgIB/f39/gICBgYGBgICAf39/gICBgYGBgICAgICAgICBgYGAgICAgICAgICBgYCAgICAgICAgICBgICAgICAgICAgICAgICAgICAgICAgICAgICA")
};
built_in_sounds.harpsichord.freq = 218;
built_in_sounds.flute.freq = 388;
built_in_sounds.boing.freq = 148;
}

function kill_audio()
{
if (!audio_context)
return;

clearTimeout(audio_context.soundStopTimeout);
audio_context.suspend();
audio_context.close();
audio_context = new (window.AudioContext || window.webkitAudioContext || function(){})({ latencyHint: 'interactive' });
unlock_audio();
audio_context.resume();
sim.sound = '';
}

function unlock_audio()
{
check_audio();
if (audio_context.unlocked)
return;

// create empty buffer
var buffer = audio_context.createBuffer(1, 1, 22050);
var source = audio_context.createBufferSource();
source.buffer = buffer;

// connect to output (your speakers)
source.connect(audio_context.destination);

// play the file
source.start(0);

audio_context.unlocked = true;
window.removeEventListener('touchstart', unlock_audio);
window.removeEventListener('pointerdown', unlock_audio);
}
window.addEventListener('touchstart', unlock_audio, true);
window.addEventListener('pointerdown', unlock_audio, true);

function loadBase64Sound(base64snd, errorCallback)
{
check_audio();

// strip any "data:audio/wav;base64," style prefix
base64snd = base64snd.substr(base64snd.indexOf(',') + 1);

var snd = {snd: null, ready: false}
audio_context.decodeAudioData(_base64ToArrayBuffer(base64snd), function(buffer) {
snd.snd = buffer
snd.ready = true
}).catch(errorCallback);
return snd;

function _base64ToArrayBuffer(base64) {
var binary_string = window.atob(base64);
var len = binary_string.length;
var bytes = new Uint8Array(len);
for (var i = 0; i < len; i++) {
bytes[i] = binary_string.charCodeAt(i);
}
return bytes.buffer;
}
}

function playSnd(sound, freq, delay=0) {
check_audio();

if (!sound.ready) return;
let source = audio_context.createBufferSource();
source.buffer = sound.snd;
source.connect(audio_context.destination);

source.playbackRate.value = ((sound.freq && sound.freq/261.616) || 1) * ((freq && freq/261.616) || 1);
source.start(audio_context.currentTime + delay/1000, 0);
}

function perform_play_note(freq, time, delay=0)
{
check_audio();

var gainNode = audio_context.createGain();
gainNode.connect(audio_context.destination);

var oscillator = audio_context.createOscillator();

oscillator.connect(gainNode);
oscillator.frequency.value = freq || 240;

var startTime = audio_context.currentTime + delay/1000;
oscillator.start(startTime);
//setTimeout(()=>oscillator.stop(), time || 250);

oscillator.frequency.setValueAtTime(freq || 240, startTime);
gainNode.gain.setValueAtTime(50, startTime);
gainNode.gain.linearRampToValueAtTime(1, startTime+.00001);
gainNode.gain.linearRampToValueAtTime(0, startTime + (time || 250)/1000 + .0001);
}
function parse_freq_and_octave(note, default_octave=4)
{
//console.log(note);
note = String(note).toUpperCase();
//debugger;
// https://newt.phys.unsw.edu.au/jw/notes.html
if (parseInt(note[0]) && typeof parseInt(note) === 'number')
return { freq: 440 * Math.pow(2,(parseInt(note)-69)/12), octave: 0 };

if (note.substr(-1)=='.')
note = note.substr(0,note.length-1);
if ("WHQESTXO".indexOf(note.substr(-1)) != -1 && note.length > 1)
note = note.substr(0,note.length-1);

var notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'], octave = 0, keyNumber;

if (/\d/.test(note.slice(-1)))
{ octave = note.slice(-1); note = note.slice(0, -1); }

if (note[0] == 'R')
return { freq: 0, octave };

var flatten = 0;
if (note.length > 1 && note.substr(-1)=='B')
{ note = note.substr(0,note.length-1); flatten = -1; }

keyNumber = notes.length-1 - notes.reverse().findIndex((n)=>note.substr(0,n.length)==n) + flatten;
//console.log(note,flatten, keyNumber);

//if (keyNumber == -1)
//	return 0;

if (keyNumber < 3) {
keyNumber = keyNumber + 12 + (((octave||default_octave) - 1) * 12) + 1;
} else {
keyNumber = keyNumber + (((octave||default_octave) - 1) * 12) + 1;
}

return { freq: 440 * Math.pow(2, (keyNumber- 49) / 12), octave };
}
function get_relative_duration(note, prevDuration=0.25)
{
var dotted;
if (note.substr(-1)=='.')
{ dotted = true; note = note.substr(0,note.length-1); }

var i = "WHQESTXO".indexOf(note.substr(-1));
if (i == -1 || note.length < 2) return prevDuration;	// length < 2 disallows plain "e" note becoming whole
return Math.pow(2,-(i)) * (dotted ? 1.5 : 1);
}

function perform_system_beep()
{
playSnd(built_in_sounds.beep);
}

// perform_classic_play_command("harpsichord aw b c de de ee fe gw gs gs gs a#w");
function perform_classic_play_command(first, notes)
{
check_audio();

var narray = notes ? String(notes).toUpperCase().split(/\s+/) : []
narray.unshift(String(first));
var sndName = narray[0], snd = sim.stack.localWAVs[sndName.toLowerCase()] || built_in_sounds[sndName.toLowerCase()];
if (snd) narray.shift();
var rd = 0.25, t = 0, tempo = 2, octave = 4, snd_duration = 0;
if (narray[0] && narray[0].toLowerCase()=='tempo') { narray.shift(); tempo = 250 / number(narray.shift()); }
if (snd && !narray.length) { narray = ['C']; snd_duration = snd.ready && snd.snd.duration; }
narray = narray.map((w)=>{ var fo = parse_freq_and_octave(w,octave); octave=(fo.octave||octave); return [fo.freq, snd_duration || (rd=get_relative_duration(w,rd))]; });
rd = 0.25;
if (audio_context.soundStopACTime > audio_context.currentTime) t = (audio_context.soundStopACTime - audio_context.currentTime)*1000;
narray.forEach((n)=>{ rd = n[1] || rd; if (n[0]) snd ? playSnd(snd, n[0], t) : perform_play_note(n[0], 1000*rd*tempo, t); t += snd_duration*1000 || 1000*rd*tempo; });
sim.sound = snd ? sndName : 'tone';
audio_context.soundStopACTime = audio_context.currentTime + t/1000;
clearTimeout(audio_context.soundStopTimeout);
audio_context.soundStopTimeout = setTimeout(()=>{ if (!audio_context.soundStopACTime || audio_context.currentTime >= audio_context.soundStopACTime) sim.sound=''; }, t+10);
}

/*
A billion gigabytes of thanks to HC retrohackers for figuring out WOBA.
*/

function renderWOBA(WOBA, ctx, magnify)
{
try
{
var boundsRect = new Rectangle(WOBA[1], WOBA[0], WOBA[3]-WOBA[1], WOBA[2]-WOBA[0]);
var maskRect = new Rectangle(WOBA[5], WOBA[4], WOBA[7]-WOBA[5], WOBA[6]-WOBA[4]);
var imageRect = new Rectangle(WOBA[9], WOBA[8], WOBA[11]-WOBA[9], WOBA[10]-WOBA[8]);
var mbytes = new Uint8Array(atob(WOBA[12]).split('').map((c)=>c.charCodeAt(0)));
var ibytes = new Uint8Array(atob(WOBA[13]).split('').map((c)=>c.charCodeAt(0)));
var maskPixels = WOBA[12].length && decodeWOBA(boundsRect, maskRect, mbytes, 0, mbytes.length);
var imagePixels = WOBA[13].length && decodeWOBA(boundsRect, imageRect, ibytes, 0, ibytes.length);
var imgData = ctx.createImageData(boundsRect.width * magnify, boundsRect.height * magnify);

var b = 0;
for (var br = 0; br < boundsRect.height; br++)
{
var i = br * boundsRect.width*magnify*magnify*4;
for (var bc = 0; bc < boundsRect.width; bc++)
{
var color, alpha;
if (imagePixels && imagePixels[Math.floor(b/8)] & (0x80>>(b%8)))
{ color = 0; alpha = 255; }
else if (maskPixels && maskPixels[Math.floor(b/8)] & (0x80>>(b%8)))
{ color = 255; alpha = 255; }
else if (!maskPixels && bc >= maskRect.x && bc < maskRect.x+maskRect.width && br >= maskRect.y && br < maskRect.y+maskRect.height)
{ color = 255; alpha = 255; }
else
{ color = 0; alpha = 0; }

for (var mr=0; mr<magnify; mr++)
{
for (var mc=0; mc<magnify; mc++)
{
imgData.data[i+0 + mc*4 + mr*boundsRect.width*magnify*4]
= imgData.data[i+1 + mc*4 + mr*boundsRect.width*magnify*4]
= imgData.data[i+2 + mc*4 + mr*boundsRect.width*magnify*4] = color;
imgData.data[i+3 + mc*4 + mr*boundsRect.width*magnify*4] = alpha;
}
}
i += 4*magnify;
b++;
}
}

//console.log(i,imgData.data.length/4,b,imagePixels.length*8);
ctx.putImageData(imgData, 0, 0);
}
catch (e)
{
console.warn('Could not read WOBA');
}
}

function pickupWOBA(ctx)
{
var width = ctx.canvas.width, height = ctx.canvas.height;
var imgData = ctx.getImageData(0, 0, width, height);
var mbytes = new Uint8Array(width * height / 8);
var ibytes = new Uint8Array(width * height / 8);
// need to round up to nearest 32 pixels or whatever
for (var y = 0; y < height; y++) {
for (var x = 0; x < width; x+=8) {
var pixel = (y * width + x) * 4, wloc = (y * width + x)/8;
var mbyte = 0, ibyte = 0;
for (var p = 0; p < 8; p++) {
mbyte <<= 1;
ibyte <<= 1;
if (imgData.data[pixel+p*4+3] >= 128) {
mbyte |= 1;
if (imgData.data[pixel+p*4+0]+imgData.data[pixel+p*4+1]+imgData.data[pixel+p*4+2] < 128*3)
ibyte |= 1;
}
}
mbytes[wloc] = mbyte;
ibytes[wloc] = ibyte;
}
}

var WOBA = [
0, 0, height, width,
0, 0, height, width,
0, 0, height, width,
btoa(Array.from(encodeWOBA(new Rectangle(0,0,width,height), mbytes)).map((n)=>String.fromCharCode(n)).join('')),
btoa(Array.from(encodeWOBA(new Rectangle(0,0,width,height), ibytes)).map((n)=>String.fromCharCode(n)).join(''))
];
return WOBA;
}

function Rectangle(x,y,width,height) { this.x = x; this.y = y; this.width = width; this.height = height; }

function snap32(/*Rectangle*/ r) {
/*int*/ var left = r.x & ~0x1F;
/*int*/ var right = r.x+r.width;
if ((right & 0x1F) != 0) {
right |= 0x1F;
right++;
}
return new Rectangle(left, r.y, right-left, r.height);
}

//	private static byte[] decodeWOBA(Rectangle totr, Rectangle r, byte[] data, int offset, int l) {
function decodeWOBA(totr, r, data, offset, l)
{
/*Rectangle*/ var tr = snap32(totr);
/*int*/ var trw = tr.width >> 3;
/*Rectangle*/ var rf = snap32(r);
/*int*/ var rw = rf.width >> 3;
/*byte[]*/ var stuff = new /*byte[trw*tr.height]*/ Uint8Array(trw*tr.height);

try
{
if (l == 0) {
if (r.width > 0 && r.height > 0) {
/*int*/ var sbyte = r.x >> 3;
/*int*/ var sbit = r.x & 0x7;
/*int*/ var ebyte = (r.x+r.width) >> 3;
/*int*/ var ebit = (r.x+r.width) & 0x7;
/*int*/ var base = trw*r.y;
for (/*int*/ var y=r.y; y<r.y+r.height; y++) {
stuff[base+sbyte] = /*(byte)*/(0xFF >> sbit);
for (/*int*/ var x=sbyte+1; x<ebyte; x++) {
stuff[base+x] = /*(byte)*/0xFF;
}
if (ebit>0) stuff[base+ebyte] = /*(byte)*/(0xFF << (8-ebit));
base += trw;
}
}
} else {
/*int*/ var p = offset;
/*int*/ var y = rf.y-tr.y;
/*int*/ var base = trw*y + ((rf.x-tr.x) >> 3);
/*int*/ var pp = base;
/*int*/ var repeat = 1;
/*int*/ var dh = 0, dv = 0;
var patt = new Uint8Array([0xAA,0x55,0xAA,0x55,0xAA,0x55,0xAA,0x55]);
while (y<rf.y-tr.y+rf.height && p<data.length) {
var /*byte*/ opcode = data[p++];
if ((opcode & 0x80) == 0) {
/*int*/ var d = (opcode & 0x70) >> 4;
/*int*/ var z = opcode & 0x0F;
var /*byte[]*/ dat = new Uint8Array(d);//byte[d];
for (/*int*/ var i=0; i<d; i++) dat[i] = data[p++];
while ((repeat--) > 0) {
pp += z;
for (/*int*/ var i=0; i<d; i++) stuff[pp++] = dat[i];
}
} else if ((opcode & 0xE0) == 0xA0) {
repeat = (opcode & 0x1F);
continue;
} else if ((opcode & 0xE0) == 0xC0) {
/*int*/ var d = (opcode & 0x1F) << 3;
var /*byte[]*/ dat = new /*byte[d];*/ Uint8Array(d);
for (/*int*/ var i=0; i<d; i++) dat[i] = data[p++];
while ((repeat--) > 0) {
for (/*int*/ var i=0; i<d; i++) stuff[pp++] = dat[i];
}
} else if ((opcode & 0xE0) == 0xE0) {
pp += ((opcode & 0x1F) << 4)*repeat;
} else {
switch (opcode) {
case /*(byte)*/0x80: {
var /*byte[]*/ dat = new /*byte[rw]*/ Uint8Array(rw);
for (/*int*/ var i=0; i<rw; i++) dat[i] = data[p++];
while ((repeat--) > 0) {
for (/*int*/ var i=0; i<rw; i++) stuff[pp++] = dat[i];
y++;
base += trw;
pp = base;
}
repeat = 1;
}
break;
case /*(byte)*/0x81: {
y += repeat;
base += trw*repeat;
pp = base;
repeat = 1;
}
break;
case /*(byte)*/0x82: {
while ((repeat--) > 0) {
for (/*int*/ var i=0; i<rw; i++) stuff[pp++] = -1;
y++;
base += trw;
pp = base;
}
repeat = 1;
}
break;
case /*(byte)*/0x83: {
var /*byte*/ pb = data[p++];
while ((repeat--) > 0) {
patt[y & 0x7] = pb;
for (/*int*/ var i=0; i<rw; i++) stuff[pp++] = pb;
y++;
base += trw;
pp = base;
}
repeat = 1;
}
break;
case /*(byte)*/0x84: {
while ((repeat--) > 0) {
var /*byte*/ pb = patt[y & 0x7];
for (/*int*/ var i=0; i<rw; i++) stuff[pp++] = pb;
y++;
base += trw;
pp = base;
}
repeat = 1;
}
break;
case /*(byte)*/0x85: {
while ((repeat--) > 0) {
for (/*int*/ var i=0; i<rw; i++) {
stuff[pp] = stuff[pp-trw];
pp++;
}
y++;
base += trw;
pp = base;
}
repeat = 1;
}
break;
case /*(byte)*/0x86: {
while ((repeat--) > 0) {
for (/*int*/ var i=0; i<rw; i++) {
stuff[pp] = stuff[pp-(trw*2)];
pp++;
}
y++;
base += trw;
pp = base;
}
repeat = 1;
}
break;
case /*(byte)*/0x87: {
while ((repeat--) > 0) {
for (/*int*/ var i=0; i<rw; i++) {
stuff[pp] = stuff[pp-(trw*3)];
pp++;
}
y++;
base += trw;
pp = base;
}
repeat = 1;
}
break;
case /*(byte)*/0x88: dh = 16; dv = 0; break;
case /*(byte)*/0x89: dh = 0; dv = 0; break;
case /*(byte)*/0x8A: dh = 0; dv = 1; break;
case /*(byte)*/0x8B: dh = 0; dv = 2; break;
case /*(byte)*/0x8C: dh = 1; dv = 0; break;
case /*(byte)*/0x8D: dh = 1; dv = 1; break;
case /*(byte)*/0x8E: dh = 2; dv = 2; break;
case /*(byte)*/0x8F: dh = 8; dv = 0; break;
}
continue;
}

repeat = 1;
if (pp >= base+rw) {
if (dh != 0) {
var /*byte[]*/ row = new /*byte[rw]*/ Uint8Array(rw);
for (/*int*/ var i=0; i<rw; i++) row[i] = stuff[base+i];
/*int*/ var numshifts = (rw << 3)/dh;
while ((numshifts--) > 0) {
/*int*/ var acc = 0;
for (/*int*/ var i=0; i<rw; i+=4) {
/*int*/ var tmp = ((row[i] & 0xFF) << 24) | ((row[i+1] & 0xFF) << 16) | ((row[i+2] & 0xFF) << 8) | (row[i+3] & 0xFF);
/*int*/ var rowi = acc | (tmp >>> dh);
row[i] = /*(byte)*/((rowi >>> 24) & 0xFF);
row[i+1] = /*(byte)*/((rowi >>> 16) & 0xFF);
row[i+2] = /*(byte)*/((rowi >>> 8) & 0xFF);
row[i+3] = /*(byte)*/(rowi & 0xFF);
acc = tmp << (32-dh);
}
for (/*int*/ var i=0; i<rw; i++) stuff[base+i] ^= row[i];
}
}
if (dv != 0 && y-dv >= 0) {
for (/*int*/ var i=0; i<rw; i++) stuff[base+i] = /*(byte)*/(stuff[base+i] ^ stuff[(base-(trw*dv))+i]);
}
y++;
base += trw;
pp = base;
}
}
}
} catch (e) {
//Malformed data did this to us.
//HyperCard would just crashy crashy with malformed WOBA data;
//we'll be better than that.
throw e;
}

return stuff;
}

/*private static byte[]*/ function encodeWOBA(/*Rectangle*/ totr, /*byte[]*/ stuff) /*throws IOException*/
{
/*
* NOTE - For encoding, we do not currently implement all the features
* necessary to get the smallest possible compression. We just implement
* a smaller subset of possible operations.
*/
/*int*/ var bpr = snap32(totr).width >> 3;
/*ByteArrayOutputStream*/ var out = /*new ByteArrayOutputStream()*/ [];
/*byte[]*/ var patt = [0xAA,0x55,0xAA,0x55,0xAA,0x55,0xAA,0x55];
/*byte[]*/ var prevprevrow = null;
/*byte[]*/ var prevrow = null;
for (/*int*/ var y = 0, sy = 0; y < totr.height && sy < stuff.length; y++, sy += bpr) {
/*byte[]*/ var row = new /*byte[bpr]*/ Array(bpr);
/*byte*/ var npatt = stuff[sy];
/*boolean*/ var isBlack = true;
/*boolean*/ var isNewPattern = true;
/*boolean*/ var isOldPattern = true;
/*boolean*/ var isWhite = true;
/*boolean*/ var isPrevRow = true;
/*boolean*/ var isPrevPrevRow = true;
for (/*int*/ var x = 0, sx = sy; x < bpr && sx < stuff.length; x++, sx++) {
row[x] = stuff[sx];
if (row[x] != /*(byte)*/0xFF) isBlack = false;
if (row[x] != npatt) isNewPattern = false;
if (row[x] != patt[y & 7]) isOldPattern = false;
if (row[x] != /*(byte)*/0x00) isWhite = false;
if (prevrow == null || row[x] != prevrow[x]) isPrevRow = false;
if (prevprevrow == null || row[x] != prevprevrow[x]) isPrevPrevRow = false;
}
if (isWhite) out.push(0x81);
else if (isBlack) out.push(0x82);
else if (isPrevRow) out.push(0x85);
else if (isPrevPrevRow) out.push(0x86);
else if (isOldPattern) out.push(0x84);
else if (isNewPattern) {
out.push(0x83);
out.push(npatt);
patt[y & 7] = npatt;
}
else {
out.push(0x80);
out = out.concat(row);
}
prevprevrow = prevrow;
prevrow = row;
}
return out;
}


function unpack_ICONs(resources)
{
var workcanvas = document.createElement('canvas');
var ImportedICONImages = {};
resources.forEach((icon)=>{
workcanvas.width = workcanvas.height = 34;
var ctx = workcanvas.getContext('2d');
var imgData = ctx.createImageData(32,32), bitmap = atob(icon.data);
for (var i = 0; i < imgData.data.length; i += 4)
{
var bit = bitmap.charCodeAt(Math.floor(i/32)) & (0x80>>((i/4)%8));
imgData.data[i+0] = bit ? 0 : 255;
imgData.data[i+1] = bit ? 0 : 255;
imgData.data[i+2] = bit ? 0 : 255;
imgData.data[i+3] = 255;
}
ctx.fillStyle = 'white';
ctx.fillRect(0,0,workcanvas.width,workcanvas.height);
ctx.putImageData(imgData,1,1);	// put it at 1,1

var canvasWidth = workcanvas.width, canvasHeight = workcanvas.height, clickloc = {x:0,y:0}, context = ctx, dpr=1;
var colorLayer = context.getImageData(0,0,canvasWidth,canvasHeight);
var pixelStack = [[Math.floor(clickloc.x*dpr), Math.floor(clickloc.y*dpr)]];
var time = Date.now(), pops = 0;
var startR=(colorLayer.data[(Math.floor(clickloc.y*dpr)*canvasWidth + Math.floor(clickloc.x*dpr))*4]);
var startG=(colorLayer.data[(Math.floor(clickloc.y*dpr)*canvasWidth + Math.floor(clickloc.x*dpr))*4+1]);
var startB=(colorLayer.data[(Math.floor(clickloc.y*dpr)*canvasWidth + Math.floor(clickloc.x*dpr))*4+2]);
var startA=(colorLayer.data[(Math.floor(clickloc.y*dpr)*canvasWidth + Math.floor(clickloc.x*dpr))*4+3]);
//console.log(startR,startG,startB,startA);

while(pixelStack.length)
{
var newPos, x, y, pixelPos, reachLeft, reachRight;
newPos = pixelStack.pop();
x = newPos[0];
y = newPos[1];
pops++;
if (pops > 1000000) throw "aborting bucket";

pixelPos = (y*canvasWidth + x) * 4;
while(y-- >= 0 && matchStartColor(pixelPos))
pixelPos -= canvasWidth * 4;
pixelPos += canvasWidth * 4;
++y;
reachLeft = false;
reachRight = false;
while(y++ < canvasHeight-1 && matchStartColor(pixelPos))
{
/*colorLayer.data[pixelPos] = 197;
colorLayer.data[pixelPos+1] = 82;
colorLayer.data[pixelPos+2] = 142;*/
colorLayer.data[pixelPos+3] = 0;

if(x > 0)
{
if (matchStartColor(pixelPos - 4))
{
if(!reachLeft){
pixelStack.push([x - 1, y]);
reachLeft = true;
}
}
else if (reachLeft)
{
reachLeft = false;
}
}

if(x < canvasWidth-1)
{
if (matchStartColor(pixelPos + 4))
{
if(!reachRight)
{
pixelStack.push([x + 1, y]);
reachRight = true;
}
}
else if (reachRight)
{
reachRight = false;
}
}

pixelPos += canvasWidth * 4;
}
}

function matchStartColor(pixelPos)
{
var r = colorLayer.data[pixelPos];
var g = colorLayer.data[pixelPos+1];
var b = colorLayer.data[pixelPos+2];
var a = colorLayer.data[pixelPos+3];

return (r===startR && g===startG && b===startB && a===startA);
}

workcanvas.width = workcanvas.height = 32;
ctx = workcanvas.getContext('2d');
ctx.clearRect(0,0,32,32);
ctx.putImageData(colorLayer, -1, -1, 1, 1, 32, 32);

ImportedICONImages[icon.ID] = workcanvas.toDataURL('image/gif');
if (icon.name && !ImportedICONImages[icon.name]) ImportedICONImages[icon.name] = icon.ID;
});

return ImportedICONImages;
}





"use strict";
var sim;
function load_wildcard_script(provided_script)
{
if (sim) sim.remove();

sim = new XTalk(document, provided_script || wildcard_script.contents, {
fallbackToJS: true, xdontComplain: true,		// not sure about dontComplain when it defaults to JS anyway
dontYield: true,	/* for now this will keep command-period from boinking inside the sim script, but will freeze if there's a runaway coroutine */
errorProc(line, error) {
console.log('error in simulator script line ' + line + ': ' + error);
if (window.wildcard_script) {
getSelection().selectAllChildren(wildcard_script.qsa('div')[line-1]);
wildcard_script.qsa('div')[line-1].setAttribute('data-suffix', 'error');
}
}
});
//wildcard = sim;

// sim.stack, sim.background, sim.card
Object.defineProperty(sim, 'stack', {
get() { return body.qs('#stackcontainer > modal-dialog.current > stack-part') || body.qs('stack-part'); }
});
Object.defineProperty(sim, 'background', {
get() { return sim.stack && sim.card.background; }
});
Object.defineProperty(sim, 'card', {
get() { return sim.stack && sim.stack.qs('card-part.current'); },
set(card) { card.closest('stack-part').card = card; },
});
Object.defineProperty(sim, 'selection', {
get() { return sim.stack && sim.stack.selectedPart; },
set(part) { (part.closest('stack-part') || sim.stack).selectedPart = part; },
});

if (!provided_script)
wildcard_script.childNodes.forEach((c,i)=>{
if (c.nodeName!=='DIV') return;
c.setAttribute('data-prefix', '\t'.repeat(sim.raw.lineinfo[i].indent));
c.setAttribute('data-suffix', sim.raw.lineinfo[i].error || '');	// the wildcard script might not even have errors because it falls back to JS
});
}

;
load_wildcard_script(XTalk.DefaultMainScript);

function marching_ants(element, template)
{
function fit(target, mutationZone)
{
var left = target.offsetLeft, top = target.offsetTop, parent = target.offsetParent;
while (parent && parent !== element.parentNode && parent !== element.getRootNode().host) {
//console.log(parent);
var cs = getComputedStyle(parent);
left += parseFloat(cs.borderLeftWidth) + parent.offsetLeft - parent.scrollLeft;
top += parseFloat(cs.borderTopWidth) + parent.offsetTop - parent.scrollTop;
parent = parent.offsetParent;
}

element.style.left = left + parseFloat(element.inset) + 'px';
element.style.top = top + parseFloat(element.inset) + 'px';
element.style.width = target.offsetWidth - 2*parseFloat(element.inset) + 'px';
element.style.height = target.offsetHeight - 2*parseFloat(element.inset) + 'px';
}

var mo;
return {
setTarget(target, mutationZone)
{
if (mo)
{ mo.disconnect(); mo = null; }
element.visible = !!target;
if (!mutationZone)
mutationZone = target.parentNode;
if (target) {
(mo=new MutationObserver((mlist)=>{
fit(target, mutationZone);
})).observe(mutationZone, {childList: true, attributes: true, characterData: true, subtree: true});
fit(target, mutationZone);
}
}
};
}
ElementTemplate.Create("marching-ants", "inset=0,visible", "",`<style>
:host
{
position: absolute; left: 0px; top: 0px; width: 100px; height: 100px;
background-image: linear-gradient(to right, #FFFF 50%, #000F 50%),
linear-gradient(to right, #FFFF 50%, #000F 50%),
linear-gradient(to bottom, #FFFF 50%, #000F 50%),
linear-gradient(to bottom, #FFFF 50%, #000F 50%);
background-size: 8px 1px, 8px 1px, 1px 8px, 1px 8px;
background-position: 0 0, 0 100%, 0 0, 100% 0;
background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
animation: ants-border 0.25s infinite 0.1s linear;
pointer-events: none;
transform: translate3d(0,0,0);
}
:host(:not([visible="true" i])) {
display: none;
}
@keyframes ants-border
{
0% { background-position: 0 0, 0 100%, 0 0, 100% 0; }
100% { background-position: 8px 0, -8px 100%, 0 -8px, 100% 8px; }
}
</style>`);

"use strict";
function xtalk_common_template(element, template)
{
return {
set script(value)
{ new XTalk(element, value); if (XTalk.ScriptWasChanged) XTalk.ScriptWasChanged(); },
set longName(value) {
element.name = value;
},
get longName() {
var type = element.nodeName.toLowerCase().split('-',1)[0];
if (type == 'stack')
return 'stack "'+element.name+'"';
if (type == 'button' || type == 'field')
type = { 'card-part': 'card ', 'background-part': 'bkgnd ', '-': '' }[(element.closest('card-part,background-part')||{nodeName:'-'}).nodeName.toLowerCase()] + type;
return type + ' ' + (element.name ? '"'+element.name+'"' : element.id ? 'id ' + element.id : element.number);
},
set longID(value) {
element.id = value;
},
get longID() {
var type = element.nodeName.toLowerCase().split('-',1)[0];
if (type == 'stack')
return 'stack "'+element.name+'"';
if (type == 'button' || type == 'field')
type = { 'card-part': 'card ', 'background-part': 'bkgnd ', '-': '' }[(element.closest('card-part,background-part')||{nodeName:'-'}).nodeName.toLowerCase()] + type;
return type + ' ' + (/*element.name ? '"'+element.name+'"' :*/ element.id ? 'id ' + element.id : element.number);
},
get longNumber() {
var type = element.nodeName.toLowerCase().split('-',1)[0];
if (type == 'stack')
return 'stack "'+element.name+'"';
var layerName = { 'card-part': 'card ', 'background-part': 'bkgnd ', '-': '' }[(element.closest('card-part,background-part')||{nodeName:'-'}).nodeName.toLowerCase()];
return layerName + ((type == 'button' || type == 'field') ? type : '') + (element.owner ? ' ' + element.number : '');
}
};
}
ElementTemplate.Create("xtalk-common-template", "name='',script=''", "",);

document.write('<style>' + `

stack-part {
--card-width: 512px; --card-height: 342px;
--modal-dialog-modal-absolute: absolute;
outline: none;
position: relative;
z-index: 0;
width: var(--card-width);
height: var(--card-height);
}
stack-part {
user-select: none; -webkit-user-select: none;
-webkit-text-size-adjust: none;
-webkit-touch-callout: none;
-webkit-tap-highlight-color: transparent;
}
stack-part > card-part > *
{ transform: translate3d(0,0,0); } 	/* this, finally, seems to fix the ghastly transform clipping bug in Safari */

stack-part div[contenteditable]
{ user-select: initial; -webkit-user-select: initial; }
.bold { font-weight: bold; }
.underline { text-decoration: underline; }
.italic { font-style: italic; }
.outline { -webkit-text-stroke: 0.25px black; text-stroke: 0.25px black; color: white; caret-color: black; font-weight: bold; }
.shadow { text-shadow: 1px 1px 2px gray; }
.outline.shadow { text-shadow: 1px 1px 0px black; letter-spacing: 1px; }
.condense:not(.extend) { letter-spacing: -1px; }
.extend:not(.condense) { letter-spacing: 1px; }
.group { text-decoration: underline; text-decoration-style: dotted; text-decoration-thickness: 2px; }
[textAlign="left" i] { text-align: left; }
[textAlign="center" i] { text-align: center; }
[textAlign="right" i] { text-align: right; }

stack-part.background-mode {
--stack-background-mode-empty-url: url();
--stack-background-mode-cover: cover;
--stack-background-mode-normal: normal;
}

modal-dialog.frameless stack-part {
margin: 0;
}
modal-dialog.frameless stack-part card-part.current {
/*box-shadow: none !important; */
}
modal-dialog stack-part:not(.background-mode) card-part.current {
xbox-shadow: 1px 1px 0px black;
}
/* these really draw over the window frame */
/*stack-part.background-mode card-part.current {
outline: 1px dotted white;
}
@media (prefers-color-scheme: dark) {
stack-part.background-mode card-part.current {
outline: 1px dotted black;
}
}*/
stack-part:not(.background-mode) card-part {
--override-backgrounded-card-color: transparent;
}
stack-part card-part:not(.current) {
display: none;	/* huge speedup */
}

stack-part.background-mode > card-part {
background: transparent !important;
--background-mode-none: none;
--background-mode-hidden: hidden;
}
stack-part.background-mode > card-part > * {
display: none;
}

body.command.option stack-part[tool="Button" i]:not(.background-mode), body.command.option stack-part[tool="Field" i]:not(.background-mode) {
--card-button-part-outline: 2px dotted black;
--card-field-part-outline: 2px dotted black;
}

body.command.option stack-part[tool="Button" i].background-mode, body.command.option stack-part[tool="Field" i].background-mode {
--bkgnd-button-part-outline: 2px dotted black;
--bkgnd-field-part-outline: 2px dotted black;
}

body.command.option stack-part[tool="Button" i] { --bkgnd-button-part-outline: 2px dotted black; }
body.command.option stack-part[tool="Field" i] { --bkgnd-field-part-outline: 2px dotted black; }
body.command.option.shift stack-part[tool="Button" i] { --bkgnd-field-part-outline: 2px dotted black; }
body.command.option.shift stack-part[tool="Field" i] { --bkgnd-button-part-outline: 2px dotted black; }

body.command.option stack-part:not([tool]):not(.background-mode)
{ --card-button-part-outline: 2px dotted black; --card-field-part-outline: 2px dotted black; }
body.command.option stack-part:not([tool])/*.background-mode*/
{ --bkgnd-button-part-outline: 2px dotted black; --bkgnd-field-part-outline: 2px dotted black; }

body.command.option:not(.contextmenu) stack-part {
--card-or-bkgnd-part-pointer-events: none;
}
body:not(.contextmenu) stack-part[tool] {
--card-or-bkgnd-part-pointer-events: none;
}

body.command.option stack-part > card-part *[visible="false" i],
stack-part[tool="Button" i] > card-part button-part[visible="false" i],
stack-part[tool="Field" i] > card-part field-part[visible="false" i]
{
--override-visibility: initial;	/* this causes an overlay to block things you need to work on; i think it should be sorted last in the list */
opacity: 0.25;
z-index: 0;
}
stack-part
{ --tool-touch-action: none; }
stack-part[tool]
{ cursor: default; }
stack-part[tool="Pencil" i],
stack-part[tool="Brush" i],
stack-part[tool="Eraser" i],
stack-part[tool="Bucket" i],
stack-part[tool="Line" i],
stack-part[tool="Rectangle" i],
stack-part[tool="Round Rect" i],
stack-part[tool="Oval" i],
stack-part[tool="Curve" i],
stack-part[tool="Polygon" i],
stack-part[tool="Select" i]
{ cursor: crosshair; }
stack-part[tool="Text" i]
{ cursor: text; }
stack-part[tool="Pencil" i]:active,
stack-part[tool="Brush" i]:active,
stack-part[tool="Eraser" i]:active
stack-part[tool="Line" i]:active,
stack-part[tool="Rectangle" i]:active,
stack-part[tool="Round Rect" i]:active,
stack-part[tool="Oval" i]:active,
stack-part[tool="Curve" i]:active,
stack-part[tool="Polygon" i]:active
{ cursor: none; }

body.command:not(.option) stack-part[tool="Button" i], body.command:not(.option) stack-part[tool="Field" i]
{ cursor: crosshair; }

body:not(.contextmenu) stack-part[tool] > card-part *:not(field-part) {
-webkit-user-select: none; user-select: none;
pointer-events: none;
}
body:not(.contextmenu) stack-part[tool="Field" i] > card-part field-part {
-webkit-user-select: none; user-select: none;
xpointer-events: none;
}

stack-part[tool="Button" i], stack-part[tool="Field" i] {
--card-button-part-outline: 1px solid gray;
--bkgnd-button-part-outline: 1px solid gray;
--card-field-part-outline: 1px solid gray;
--bkgnd-field-part-outline: 1px solid gray;
}
stack-part[tool="Field" i] field-part {
--special-field-tool-background: repeating-linear-gradient(var(--background, transparent), var(--background, transparent) calc(1.125em - 1px), #CCC 1.125em);
--special-field-tool-background-color-attribute: repeating-linear-gradient(var(--color-attribute, var(--background, transparent)), var(--color-attribute, var(--background, transparent)) calc(1.125em - 1px), #CCC 1.125em);
}
stack-part[tool="Button" i]:not(.background-mode)
{ --card-button-part-outline: 1px solid black; --bkgnd-button-part-outline: 1px solid gray; }
stack-part[tool="Field" i]:not(.background-mode)
{ --card-field-part-outline: 1px solid black; --bkgnd-field-part-outline: 1px solid gray; }
stack-part[tool="Button" i].background-mode { --bkgnd-button-part-outline: 1px solid black; }
stack-part[tool="Field" i].background-mode { --bkgnd-field-part-outline: 1px solid black; }

/* recent card visual effects */
stack-part card-part { clip-path: inset(0px 0px); }	/* this doesn't seem to trigger safari xor drawing bug! but i don't even like the clippath animation*/

stack-part card-part.forward-card:not(.current) {
display: initial;
position: absolute; left: 0px; top: 0px;
background: white;
z-index: 2;
opacity: 0;
pointer-events: none;
}

stack-part[visualEffect] { --visual-effect-duration: 0.5s; }
stack-part[visualEffect~="slow" i], stack-part[visualEffect~="slowly" i] { --visual-effect-duration: 1s; }
stack-part[visualEffect~="very" i][visualEffect~="slow"], stack-part[visualEffect~="very" i][visualEffect~="slowly" i] { --visual-effect-duration: 2s; }
stack-part[visualEffect~="fast" i] { --visual-effect-duration: 0.25s; }
stack-part[visualEffect~="very" i][visualEffect~="fast" i] { --visual-effect-duration: 0.1s; }

stack-part[visualEffect] > card-part.forward-card:not(.current) {
transition: transform 0.0s;
transform: scale(1) translate(0,0);
}
stack-part[visualEffect~='left'] > card-part.forward-card:not(.current) {
transition: transform var(--visual-effect-duration) , opacity 0s var(--visual-effect-duration) ;
transform: scale(1) translate(-100%, 0px);
}
stack-part[visualEffect~='right'] > card-part.forward-card:not(.current) {
transition: transform var(--visual-effect-duration), opacity 0s var(--visual-effect-duration) ;
transform: scale(1) translate(100%, 0px);
}
stack-part[visualEffect~='up'] > card-part.forward-card:not(.current) {
transition: transform var(--visual-effect-duration) , opacity 0s var(--visual-effect-duration) ;
transform: scale(1) translate(0px, -100%);
}
stack-part[visualEffect~='down'] > card-part.forward-card:not(.current) {
transition: transform var(--visual-effect-duration), opacity 0s var(--visual-effect-duration) ;
transform: scale(1) translate(0px, 100%);
}
stack-part[visualEffect~='dissolve'] > card-part.forward-card:not(.current) {
transition: transform var(--visual-effect-duration), opacity var(--visual-effect-duration);
transform: scale(1) translate(0,0);
}

` + '</style>');"use strict";
document.addEventListener('keydown',(event)=>{
if ('sim' in window && event.isTrusted && sim.stack && !body.classList.contains('command')
&& (document.activeElement === body || sim.stack.contains(document.activeElement) || sim.stack.parentNode===document.activeElement))
return sim.stack.card_key_down(event);
});

function stack_part(element,template)
{
var outline_marcher, sel_element;

function stackpoint(event, allowOutOfBounds) {
if (event.simulatedStackPoint)
return event.simulatedStackPoint;
if (event.clientX===undefined && event.touches[0])
{ event.clientX = Math.floor(event.touches[0].clientX); event.clientY = Math.floor(event.touches[0].clientY); }

var dp;
if (element.matches('modal-dialog > stack-part')) {
var dialog = element.parentNode.shadowRoot.qs('#dialog');
var content = element.parentNode.shadowRoot.qs('#content');
var x = event.clientX - content.getBoundingClientRect().x;
var y = event.clientY - content.getBoundingClientRect().y;
//console.log(element.parentNode, getComputedStyle(element.parentNode).getPropertyValue('--scale'));
x /= parseFloat(getComputedStyle(element.parentNode).getPropertyValue('--scale') || 1);
y /= parseFloat(getComputedStyle(element.parentNode).getPropertyValue('--scale') || 1);
var dp = new DOMPoint(x,y);
/*var dialogMatrix = new DOMMatrix(getComputedStyle(dialog).transform);
var dp = dialogMatrix.inverse().transformPoint(new DOMPoint(x,y));*/
if (!allowOutOfBounds) {
dp.x = Math.min(element.width-1,Math.max(0,dp.x));
dp.y = Math.min(element.height-1,Math.max(0,dp.y));
}
}
else dp = new DOMPoint(event.clientX - element.getBoundingClientRect().x, event.clientY - element.getBoundingClientRect().y);
dp.x = Math.floor(dp.x);
dp.y = Math.floor(dp.y);
return dp;
}
function offsetrect(rect,x,y) {
return [rect[0]+x,rect[1]+y,rect[2]+x,rect[3]+y];
}
function get_visible_buttonorfield_at(clientX, clientY)
{
var layer = element.currentLayer, search = Array.from(layer.qsa(':scope [topLeft], :scope [topLeft] button-part'))
.reverse()
.concat(Array.from(layer.qsa(':scope button-part:not([topLeft]), :scope field-part:not([topLeft])')).reverse());

if (layer.matches('card-part') && element.background) {
search = search.concat(
Array.from(element.background.qsa(':scope [topLeft]'))
.reverse()
.concat(Array.from(element.background.qsa(':scope button-part:not([topLeft]), :scope field-part:not([topLeft])')).reverse()));
}

var target = search.find((e)=>{
do {
if (!e.visible) return;
var bcr = e.getBoundingClientRect();
// this could be improved for buttons inside scrolling fields; make sure the click is in the parent BCR too
// i did it but this is dumb, would be better to drill in with search. oh well whatever
if (!(clientX >= bcr.x && clientX < bcr.right && clientY >= bcr.y && clientY < bcr.bottom)) return false;
} while ((e=e.parentNode.closest('field-part')) && element.contains(e));
return true;
});
return target && target.closest('button-part, field-part');
}
function card_mouse_down(event)
{
// just rewrite this entirely with the new stuff
var clickloc = stackpoint(event), layer = element.currentLayer;

if (element.tool=='Browse' && (!body.qs('#toolbar') || !body.matches('.command.option')))
{
/* regular click */
//console.log('click started');

// here's the problem: target is nothing in a simulated click.
var target = element.partOfEvent(event,'button-part,field-part,card-part');
if (!target)
target = get_visible_buttonorfield_at(event.clientX, event.clientY) || layer;

if (target.matches('button-part[enabled="false" i]'))
return;

//console.log(target);
// send the hc mouse messages
var mouseloc = clickloc, activehover = true;
sim.clickLoc = Math.round(clickloc.x)+','+Math.round(clickloc.y);
sim.mouseLoc = Math.round(mouseloc.x)+','+Math.round(mouseloc.y);
sim.mouse = 'down';
element.mouse = 'down';
element.mouseClick = true;
element.isProcessingMouseDown = true;

//XTalk.Send(target || layer, 'mouseDown');
var isdown=true, msdtimeout=false, abortmsgs=false;
function nextstep(success)
{
if (success===false) abortmsgs=true;
cancelAnimationFrame(msdtimeout); msdtimeout = null;
element.isProcessingMouseDown = isdown;
if (!isdown) {
if (activehover && target && target.matches(`button-part[family]`) && target.autoHilite && target.enabled != 'false')
target.hilite = true;
if (!abortmsgs && !(target && target.matches(`button-part[type="Popup" i]`))) XTalk.Send(target || layer, activehover ? 'mouseUp' : 'mouseCancel', []);
//console.log('click completed');
element.isProcessingMouseDown = false;
element.checkIfIdleMessagesAllowed();
}
else {
msdtimeout = window.requestAnimationFrame(()=>{ msdtimeout=null; if (!abortmsgs) { msdtimeout=true; XTalk.Send(target || layer, 'mouseStillDown', [], nextstep); } });
}
}
follow_mouse(event,
(event)=>{
mouseloc = stackpoint(event);
/*var fun = document.elementFromPoint(event.clientX, event.clientY);
if (fun && fun.matches('card-part') && fun !== target)
fun = fun.shadowRoot.elementFromPoint(event.clientX, event.clientY);
if (event.type!='mousedown')
activehover = (target || layer).matches(":active:hover") || target.contains(fun);*/
if (event.type!='mousedown') {
var bcr = (target||layer).getBoundingClientRect();
activehover = (event.clientX >= bcr.x && event.clientX < bcr.right && event.clientY >= bcr.y && event.clientY < bcr.bottom);
}
//sim.put(activehover + ' ' + Date.now() + fun.nodeName);
sim.mouseLoc = Math.round(mouseloc.x)+','+Math.round(mouseloc.y);
//sim.mouse = activehover ? 'down' : 'up';
//sim.mouse = 'down';
},
(event, begin)=>{
if (begin == true) {
msdtimeout = true;
XTalk.Send(target || layer, 'mouseDown', [], nextstep);
return true;
}
else
{
isdown = false;
sim.mouse = 'up';
element.mouse = 'up';
if (begin == 'cancel') activehover = false;
if (!msdtimeout) nextstep();
}
});

return;
}

if (['pencil','eraser','bucket','line','rectangle','round rect','oval','curve','polygon','brush','select','text','martin'].includes(element.tool.toLowerCase()))
{
/* painting tool click */
if (element.tool.toLowerCase() =='text' && event.composedPath)
{
if (layer.shadowRoot.qs('.text-tool-overlay').contains(event.composedPath()[0]))
return;
if (layer.shadowRoot.qs('.text-tool-overlay field-part'))
{
layer.shadowRoot.qs('.text-tool-overlay field-part').blur();
//debugger;
}
}

//element.focus();
if (layer) paint_mouse_down(event, layer, clickloc);
event.preventDefault(); event.stopPropagation();
return;
}

/* what is it? */

var tool_type_part = ''; (['Button','Field'].includes(element.tool) && element.tool.toLowerCase()+'-part') || '';

var search = tool_type_part
? Array.from(layer.qsa(tool_type_part)).reverse()
: Array.from(layer.qsa(':scope [topLeft], :scope [topLeft] button-part')).reverse()
.concat(Array.from(layer.qsa(':scope button-part:not([topLeft]), :scope field-part:not([topLeft])')).reverse());
if (layer.matches('card-part') && element.background) {
search = search.concat(tool_type_part
? Array.from(element.background.qsa(tool_type_part)).reverse()
: Array.from(element.background.qsa(':scope [topLeft]')).reverse()
.concat(Array.from(element.background.qsa(':scope button-part:not([topLeft]), :scope field-part:not([topLeft])')).reverse()));
//console.log(search);
}
//console.log(search);

//debugger;
var target = search.find((e)=>{
do {
if (!e.visible) return;
var bcr = e.getBoundingClientRect();
// this could be improved for buttons inside scrolling fields; make sure the click is in the parent BCR too
// i did it but this is dumb, would be better to drill in with search. oh well whatever
if (!(event.clientX >= bcr.x && event.clientX < bcr.right && event.clientY >= bcr.y && event.clientY < bcr.bottom)) return false;
} while ((e=e.parentNode.closest('field-part')) && element.contains(e));
return true;
});
target = target && target.closest('button-part, field-part');
//console.log(target || layer);

/* a command option click to script, or a command option shift click to inspect */

if (body.matches('.command.option')) {
if (body.classList.contains('fullscreen'))
leaveFullscreen(true);
/*if (target && (target.nodeName.toLowerCase()==element.tool.toLowerCase()+'-part' || body.classList.contains('shift'))) {
body.qs('#toolbar button-part[name=\"' + target.nodeName.split('-')[0] + '\" i]').click();
//element.tool = target.nodeName.split('-')[0];
element.selectedPart = target;
}*/
launch_info_dialog(target || layer, !body.classList.contains('shift'));
}
else if (body.matches('.command:not(.fullscreen)'))
{
element.selectedPart = null;
var clickX = event.clientX, clickY = event.clientY;
target = null;
follow_mouse(event, (event)=>{
var mouseloc = stackpoint(event);
target.rect = [Math.min(clickloc.x,mouseloc.x),Math.min(clickloc.y,mouseloc.y),
Math.max(clickloc.x,mouseloc.x),Math.max(clickloc.y,mouseloc.y)];
}, (event,to_begin)=>{
var wiggle = (Math.pow(event.clientX-clickX,2)+Math.pow(event.clientY-clickY,2) >= 16);
if (!to_begin) {
if (target && wiggle) element.selectedPart = target;
else if (target) layer.removeChild(target);
}
else if (wiggle) {
target = document.createElement(element.tool.toLowerCase()+'-part');
target.ID = layer.maxID + 1;
layer.appendChild(target);
return true;
}
});
}
else if (target && (element.tool == 'Button' || element.tool == 'Field'))
{
tool_type_part = (['Button','Field'].includes(element.tool) && element.tool.toLowerCase()+'-part') || '';

//console.log(element.tool.toLowerCase(), tool_type_part, element.tool.toLowerCase()+'-part' == tool_type_part);

body.qs('#toolbar button-part[name=\"' + target.nodeName.split('-')[0] + '\" i]').click();
element.selectedPart = target;

if (event.detail == 2)
launch_info_dialog(target, body.classList.contains('shift'));
else {
var clickX = event.clientX, clickY = event.clientY, clickRect = target.rect;
//console.log(clickRect);
var lt = [clickRect[0] - (clickloc.x || clickX - layer.getBoundingClientRect().x),
clickRect[1] - (clickloc.y || clickY - layer.getBoundingClientRect().y),
clickRect[2] - (clickloc.x || clickX - layer.getBoundingClientRect().x),
clickRect[3] - (clickloc.y || clickY - layer.getBoundingClientRect().y)];
var m = 12, resize = (lt[2] <= m && lt[3] <= m), newrect = clickRect, longpress = null, cancel_follow = false, cloned_target = null;

if (matchMedia("(pointer:coarse)").matches)
longpress = setTimeout(()=>{ cancel_follow = true; launch_info_dialog(target); }, 500);

follow_mouse(event, (event)=>{
var mouseloc = stackpoint(event);
if (resize)
newrect = [clickRect[0], clickRect[1], clickRect[2]+mouseloc.x-clickloc.x, clickRect[3]+mouseloc.y-clickloc.y];
else {
newrect = offsetrect(clickRect, mouseloc.x-clickloc.x, mouseloc.y-clickloc.y);
newrect = offsetrect(newrect, -Math.min(0, newrect[0]), -Math.min(0, newrect[1]))
newrect = offsetrect(newrect, -Math.max(0, newrect[2]-element.width), -Math.max(0, newrect[3]-element.height));
}
target.rect = newrect;
}, (event,to_begin)=>{
if (to_begin=='cancel')
clearTimeout(longpress);
else if (!to_begin) {
element.selectedPart = target;
element.refreshAddColorStage();
if (window.NBU2) NBU2.RegisterAction(()=>{ if (cloned_target) layer.removeChild(target); else target.rect = clickRect; element.selectedPart = cloned_target||target; },
()=>{ if (cloned_target) layer.appendChild(target); else target.rect = newrect; element.selectedPart = target; });
}
else if (cancel_follow)
{ event.preventDefault(); return false; }
else if (Math.pow(event.clientX-clickX,2)+Math.pow(event.clientY-clickY,2) >=16) {
if (longpress)
clearTimeout(longpress);
if (target.topLeft) {
if (body.classList.contains('option'))
layer.appendChild(target = (cloned_target=target).cloneNode(true));
element.selectedPart = null;
return true;
}
}
}, true);	// the true means always to end
}
}
else {
/* we dunno. bail */
element.selectedPart = null;
return;
}

return event.preventDefault();
}

function paint_mouse_down(event, layer, clickloc)
{
var canvas = layer.canvas, context = layer.canvasContext2d, dpr = Math.round(window.devicePixelRatio||1);
var canvasWidth = canvas.width, canvasHeight = canvas.height;
var tool = element.tool.toLowerCase();

var undoLayer = (!event.type.includes('simulated') || tool=='line') && context.getImageData(0,0,canvasWidth,canvasHeight);

function allowundo(colorLayer)
{
if (!undoLayer) return;
// so easy. could record max area to save space though, and put in weak map.
// i'm starting to think mark canvas dirty needs infrastructure; the layers from two successive paints are the same.
// currentData = markCanvasState(), markCanvasState(optionalNewData),
colorLayer = colorLayer || context.getImageData(0,0,canvasWidth,canvasHeight);
if (window.NBU2) NBU2.RegisterAction(
()=>{ context.putImageData(undoLayer, 0, 0); layer.markCanvasUsed(); },
()=>{ context.putImageData(colorLayer, 0, 0); layer.markCanvasUsed(); });
layer.markCanvasUsed();
}

if (element.tool == 'martin')
{
follow_mouse(event, (event)=>{
var currentpoint = stackpoint(event);
(window.MartinFunction || console.log)(event, currentpoint, canvas);
}, (event,start)=>{
if (start) return true;
var currentpoint = stackpoint(event);
(window.MartinFunction || console.log)(event, currentpoint, canvas);
layer.markCanvasUsed();
allowundo();
});
}
else if (tool == 'pencil' || tool == 'brush')
{
var prevpoint = clickloc, startpoint = clickloc;
var onBlack = context.getImageData(startpoint.x*Math.round(devicePixelRatio),startpoint.y*Math.round(devicePixelRatio),1,1).data.join() == '0,0,0,255';
//console.log([startpoint.x*Math.round(devicePixelRatio),startpoint.y*Math.round(devicePixelRatio)]);
var shrink = (tool == 'brush') ? 2 : 1;	// adjust for pattern blowing up
context.scale(1/shrink,1/shrink);
//context.translate(0.5,0.5);
context.globalCompositeOperation = body.matches('.option.shift') ? "destination-out" : "source-over";
follow_mouse(event, (event)=>{
var currentpoint = stackpoint(event);
//console.log(currentpoint);
context.lineWidth = ((tool == 'pencil') ? 1  : 4) * shrink;
context.lineJoin = 'round';
context.fillStyle = context.strokeStyle =
(tool == 'brush' && body.matches('.option.shift')) ? '#000F'
: (tool == 'pencil' && onBlack || body.classList.contains('option')) ? 'white'
: (tool == 'brush' && !body.classList.contains('shift')) ? context.gray_pattern
: 'Black';

context.beginPath();
context.moveTo(prevpoint.x * shrink, prevpoint.y * shrink);
context.lineTo(currentpoint.x * shrink, currentpoint.y * shrink);
context.stroke();
//context.endPath();
//console.log(context.getImageData(currentpoint.x*Math.round(devicePixelRatio),currentpoint.y*Math.round(devicePixelRatio),1,1).data.join() == '0,0,0,255')
if (tool == 'brush') context.ellipse(currentpoint.x* shrink, currentpoint.y* shrink,context.lineWidth/2,context.lineWidth/2,0,0,2 * Math.PI);
else context.fillRect(currentpoint.x* shrink, currentpoint.y* shrink,context.lineWidth,context.lineWidth);
context.fill();
prevpoint = currentpoint;
}, (event,start)=>{
if (start) return true;
//context.translate(-0.5,-0.5);
context.scale(shrink,shrink);
context.globalCompositeOperation = "source-over";
layer.markCanvasUsed();
allowundo();
});
}
else if (tool == 'eraser')
{
follow_mouse(event, (event)=>{
var currentpoint = stackpoint(event);
//context.putImageData(undoLayer, 0, 0);
var erasersize = 20 / ('visualViewport' in window && visualViewport.scale || 1);
context.clearRect(currentpoint.x-erasersize/2,currentpoint.y-erasersize/2,erasersize,erasersize);
prevpoint = currentpoint;
}, (event,start)=>{
if (start) return true;
layer.markCanvasUsed();
allowundo();
});
}
else if (tool == 'text')
{
var f = document.createElement('field-part');
f.style = "margin: -4px; padding: 4px; margin-top: -0.8em; padding-top: -0.8em; outline: 1px dotted #8888; outline-offset: -0.25em";
if (window.painttext_proxy)
['textFont','textSize','textStyle','textAlign','textHeight'].forEach((a)=>f[a]=painttext_proxy[a]);
f.addEventListener('blur', (event)=>{
if (f.dontBlur) return;

function getLineBreaks(node) {
// https://stackoverflow.com/questions/55604798/find-rendered-line-breaks-with-javascript
// we only deal with TextNodes
// our Range object form which we'll get the characters positions
const range = document.createRange();
// here we'll store all our lines
const lines = [];
// begin at the first char
range.setStart(node, 0);
// initial position
let prevBottom = range.getBoundingClientRect().bottom;
let str = node.textContent;
let current = 1; // we already got index 0
let lastFound = 0;
let bottom = 0;
// iterate over all characters
while(current <= str.length) {
// move our cursor
range.setStart(node, current);
if(current < str.length -1)
range.setEnd(node, current+1);
bottom = range.getBoundingClientRect().bottom;
if(bottom > prevBottom) { // line break
lines.push(
str.substr(lastFound , current - lastFound)
);
prevBottom = bottom;
lastFound = current;
}
current++;
}
// push the last line
lines.push(str.substr(lastFound));

return lines;
}
var nodes = document.createTreeWalker(f.contentsContainer(), NodeFilter.SHOW_TEXT, null, null), tn = nodes.nextNode();
if (tn) {
const range = document.createRange();
range.setStart(tn, 0);
var bcr1 = range.getBoundingClientRect(), sp1 =stackpoint({ clientX: bcr1.x, clientY: bcr1.y },true);
context.font = getComputedStyle(f).font;
context.textBaseline = 'top';
context.fillStyle = 'black';
var lh = parseFloat(getComputedStyle(f).fontSize) * 1.2;
//console.log(getComputedStyle(f).font, parseFloat(getComputedStyle(f).fontSize));
do { getLineBreaks(tn).forEach((t,i)=>{ context.fillText(t,sp1.x,sp1.y); sp1.y+=lh; }); } while (tn = nodes.nextNode());
}
f.parentNode.removeChild(f);
layer.markCanvasUsed();
allowundo();
});
f.onkeyup = ()=>{
var range = layer.shadowRoot.getSelection().getRangeAt(0);
if (range)
console.log(f.contentsContainer().innerHTML, range.commonAncestorContainer, range.startContainer, range.startOffset, range.endContainer, range.endOffset);
else console.log(f.contentsContainer().innerHTML, 'no range');
/*if (range.commonAncestorContainer===f)
{ debugger; f.FixCENow(); }*/
}
layer.shadowRoot.qs('.text-tool-overlay').appendChild(f);
f.topLeft = [clickloc.x, clickloc.y];
f.contents = "";
f.focus();
getSelection().selectAllChildren(f);
getSelection().collapseToStart();
//console.log(f);
}
else if (tool == 'line' || tool == 'rectangle' || tool == 'round rect' || tool == 'oval' || tool == 'curve' || tool == 'polygon')
{
var curvepoints = [clickloc], optionclick = body.classList.contains('option'), currentpoint = clickloc;
if (tool == 'polygon' && element.polygonDragInProgress)
return;
element.polygonDragInProgress = (tool == 'polygon');

context.fillStyle = context.gray_pattern;
var shrink = 2;	// adjust for pattern blowing up
context.scale(1/shrink,1/shrink);

follow_mouse(event, (event)=>{
if (undoLayer)
context.putImageData(undoLayer, 0, 0);
currentpoint = stackpoint(event);
context.beginPath();
context.strokeStyle = (tool == 'line' && body.classList.contains('option')) ? 'white' : 'black';
context.lineWidth = (tool != 'line' && optionclick) ? 0 : (sim.lineSize || 1)*dpr;
if (tool=='line')
{
if (body.classList.contains('shift') && Math.abs(currentpoint.x-clickloc.x) > Math.abs(currentpoint.y-clickloc.y))
currentpoint.y = clickloc.y;
else if (body.classList.contains('shift'))
currentpoint.x = clickloc.x;
context.moveTo(clickloc.x*shrink,clickloc.y*shrink);
context.lineTo(currentpoint.x*shrink,currentpoint.y*shrink);
}
else if (tool=='rectangle')
{
context.rect(clickloc.x*shrink,clickloc.y*shrink,(currentpoint.x-clickloc.x)*shrink,(currentpoint.y-clickloc.y)*shrink);
}
else if (tool=='round rect')
{
function roundRect(x, y, w, h, r)
{
if (w < 0) { x += w; w *= -1; }
if (h < 0) { y += h; h *= -1; }
r = Math.min(Math.abs(r), w/2, h/2);
context.moveTo(x+r, y);
context.arcTo(x+w, y,   x+w, y+h, r);
context.arcTo(x+w, y+h, x,   y+h, r);
context.arcTo(x,   y+h, x,   y,   r);
context.arcTo(x,   y,   x+w, y,   r);
}
roundRect(clickloc.x*shrink,clickloc.y*shrink,(currentpoint.x-clickloc.x)*shrink,(currentpoint.y-clickloc.y)*shrink,8*shrink);
}
else if (tool=='oval')
{
//context.ellipse((clickloc.x+currentpoint.x)/2,(clickloc.y+currentpoint.y)/2,(currentpoint.x-clickloc.x)/2,(currentpoint.y-clickloc.y)/2,0,0,Math.PI*2);
var x = clickloc.x, y = clickloc.y, w = (currentpoint.x-clickloc.x), h = (currentpoint.y-clickloc.y);
if (w < 0) { x += w; w *= -1; }
if (h < 0) { y += h; h *= -1; }
context.ellipse((x+w/2)*shrink,(y+h/2)*shrink,(w/2)*shrink,(h/2)*shrink,0,0,Math.PI*2);
}
else if (tool=='curve')
{
if (curvepoints[curvepoints.length-1].x != currentpoint.x || curvepoints[curvepoints.length-1].y != currentpoint.y)
curvepoints.push(currentpoint);
context.moveTo(clickloc.x*shrink,clickloc.y*shrink);
for (var i = 1; i < curvepoints.length; i++)
context.lineTo(curvepoints[i].x*shrink, curvepoints[i].y*shrink);
}
else if (tool=='polygon')
{
/*if (curvepoints[curvepoints.length-1].x != currentpoint.x || curvepoints[curvepoints.length-1].y != currentpoint.y)
curvepoints.push(currentpoint);*/
context.moveTo(clickloc.x*shrink,clickloc.y*shrink);
for (var i = 1; i < curvepoints.length; i++)
context.lineTo(curvepoints[i].x*shrink, curvepoints[i].y*shrink);
context.lineTo(currentpoint.x*shrink,currentpoint.y*shrink);
}
if (body.classList.contains('option') || optionclick)
{
context.closePath();
context.fill();
}
if (tool == 'line' || !optionclick)
context.stroke();

}, (event,start)=>{
if (start) return true;

if (tool == 'polygon')
{
// polygon mouseup just continues
console.log('finished first polygon drag');
continuePolygon(event);

function continuePolygon(event)
{
curvepoints.push(currentpoint);

follow_mouse(event, (event)=>{
currentpoint = stackpoint(event);
if (undoLayer)
context.putImageData(undoLayer, 0, 0);
context.beginPath();
context.moveTo(clickloc.x*shrink,clickloc.y*shrink);
for (var i = 1; i < curvepoints.length; i++)
context.lineTo(curvepoints[i].x*shrink, curvepoints[i].y*shrink);
context.lineTo(currentpoint.x*shrink,currentpoint.y*shrink);
if (body.classList.contains('option') || optionclick)
{
context.closePath();
context.fill();
}
context.stroke();
}, (event,start)=>{
if (start && element.polygonDragInProgress) return true;
console.log('ended polygon drag segment ');
if (!element.polygonDragInProgress ||
(currentpoint.x == curvepoints[curvepoints.length-1].x && currentpoint.y == curvepoints[curvepoints.length-1].y))
{
if (body.classList.contains('option') || optionclick)
{
context.closePath();
context.fill();
}
context.stroke();
context.scale(shrink,shrink);
layer.markCanvasUsed();
allowundo();
element.polygonDragInProgress = false;
}
else continuePolygon(event);
});
}
}
else
{
context.scale(shrink,shrink);
layer.markCanvasUsed();
allowundo();
}
});

}
else if (tool == 'select')
{
// having the layer hold a marching ants is silly when the stack has one all ready to go,
// we could easily have it do the job for us.
var select = layer.shadowRoot.qs('canvas#select'), copy = body.classList.contains('option');
if (event.composedPath()[0]===select) {
var sloc = [select.offsetLeft, select.offsetTop, select.offsetWidth, select.offsetHeight];
if (!layer.putItDown) {
// starting to move, grab the canvas
//select.width = sloc[2]*dpr; select.height = sloc[3]*dpr;
select.getContext('2d').putImageData(undoLayer, -sloc[0]*dpr, -sloc[1]*dpr);
layer.putItDown = ()=>{};
if (!copy)
context.clearRect(sloc[0],sloc[1],sloc[2],sloc[3]);
}
else if (copy)
layer.putItDown(true);

follow_mouse(event, (event)=>{
var currentpoint = stackpoint(event);
select.style.left = sloc[0]+(currentpoint.x-clickloc.x)+'px';
select.style.top = sloc[1]+(currentpoint.y-clickloc.y)+'px';
}, (event,start)=>{
select.style.background = start ? 'none' : '';
template.qs('marching-ants').visible = !start;
//	layer.shadowRoot.qs('marching-ants').style.display = start ? 'none' : 'initial';
if (start) return true;
layer.putItDown = function(markMutation,otherContext) {
//console.log(select.offsetLeft, select.offsetTop, sloc[2], sloc[3]);
(otherContext||context).drawImage(select, select.offsetLeft, select.offsetTop, sloc[2], sloc[3]);
if (markMutation) { layer.markCanvasUsed(); allowundo(); }
};
layer.markCanvasUsed();	// autosave will be able to save the new location even though it's not official
});
}
else {
if (layer.putItDown)
element.clearUserSelections();
follow_mouse(event, (event)=>{
var currentpoint = stackpoint(event);
/*currentpoint.x = Math.min(element.width-1,Math.max(0,currentpoint.x));
currentpoint.y = Math.min(element.height-1,Math.max(0,currentpoint.y));*/
layer.moveSelAnts(true, Math.min(currentpoint.x,clickloc.x), Math.min(currentpoint.y,clickloc.y),
Math.abs(currentpoint.x - clickloc.x)+1, Math.abs(currentpoint.y - clickloc.y)+1);
}, (event,start)=>{
if (start) {
layer.moveSelAnts(false);
select.copyFromLayerNow = null;
return true;
}
else if (!select.getBoundingClientRect().width || !select.getBoundingClientRect().height)
layer.moveSelAnts(false);
else {
layer.pickItUp = function(markMutation) {
context.clearRect(select.offsetLeft, select.offsetTop, select.offsetWidth, select.offsetHeight);
if (markMutation) { layer.markCanvasUsed(); allowundo(); }
}
select.copyFromLayerNow = function() {
var sloc = [select.offsetLeft, select.offsetTop, select.offsetWidth, select.offsetHeight];
select.width = sloc[2]*dpr; select.height = sloc[3]*dpr;
select.getContext('2d').putImageData(context.getImageData(0,0,canvasWidth,canvasHeight)/*undoLayer*/, -sloc[0]*dpr, -sloc[1]*dpr);
layer.putItDown = function(markMutation,otherContext) {
//console.log(select.offsetLeft, select.offsetTop, sloc[2], sloc[3]);
(otherContext||context).drawImage(select, select.offsetLeft, select.offsetTop, sloc[2], sloc[3]);
if (markMutation) { layer.markCanvasUsed(); allowundo(); }
};
context.clearRect(sloc[0],sloc[1],sloc[2],sloc[3]);
select.copyFromLayerNow = null;
}
}
});
}
}
else if (tool == 'bucket')
{
//http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/
var colorLayer = context.getImageData(0,0,canvasWidth,canvasHeight);
var pixelStack = [[Math.floor(clickloc.x*dpr), Math.floor(clickloc.y*dpr)]];
var time = Date.now(), pops = 0;
var startR=(colorLayer.data[(Math.floor(clickloc.y*dpr)*canvasWidth + Math.floor(clickloc.x*dpr))*4]);
var startG=(colorLayer.data[(Math.floor(clickloc.y*dpr)*canvasWidth + Math.floor(clickloc.x*dpr))*4+1]);
var startB=(colorLayer.data[(Math.floor(clickloc.y*dpr)*canvasWidth + Math.floor(clickloc.x*dpr))*4+2]);
var startA=(colorLayer.data[(Math.floor(clickloc.y*dpr)*canvasWidth + Math.floor(clickloc.x*dpr))*4+3]);
//console.log(startR,startG,startB,startA);

var fillColorFunc = body.matches('.option.shift') ? function(pp) { return [0,0,0,0]; }	// transparent
: body.matches('.option') ? function(pp) { return [255,255,255,255]; }	// white
: body.matches('.shift') ? function(pp) { return [0,0,0,255]; }	// black
: 'better';//function(pp,y) { return (((pp>>2)%4<2)===!(y%4<2)) ? [255,255,255,255] : [0,0,0,255]; }	// classic gray

// better than just gray, it's whatever we ask
if (fillColorFunc=='better')
{
var graycanvas = document.createElement('canvas');
graycanvas.width = 16; graycanvas.height = 16;
var graycontext = graycanvas.getContext('2d');
graycontext.drawImage(grayPngImg,0,0);
var grayimgdata = graycontext.getImageData(0,0,16,16);
fillColorFunc = function(pp,x,y) {
var where = ((y%16)*16 + (x % 16)) * 4;
return [grayimgdata.data[where], grayimgdata.data[where+1], grayimgdata.data[where+2], grayimgdata.data[where+3]];
}
}

while(pixelStack.length)
{
var newPos, x, y, pixelPos, reachLeft, reachRight;
newPos = pixelStack.pop();
x = newPos[0];
y = newPos[1];
pops++;
if (pops > 1000000) throw "aborting bucket";

pixelPos = (y*canvasWidth + x) * 4;
while(y-- >= 0 && matchStartColor(pixelPos))
pixelPos -= canvasWidth * 4;
pixelPos += canvasWidth * 4;
++y;
reachLeft = false;
reachRight = false;
while(y++ < canvasHeight-1 && matchStartColor(pixelPos))
{
// coloring a color the same color never terminates
// lets color it an unlilekely color to start
colorLayer.data[pixelPos] = 197;
colorLayer.data[pixelPos+1] = 82;
colorLayer.data[pixelPos+2] = 142;
colorLayer.data[pixelPos+3] = 223;

/*var ch = fillColorFunc(pixelPos,y);
colorLayer.data[pixelPos] = ch[0];
colorLayer.data[pixelPos+1] = ch[1];
colorLayer.data[pixelPos+2] = ch[2];
colorLayer.data[pixelPos+3] = ch[3];*/

if(x > 0)
{
if(matchStartColor(pixelPos - 4))
{
if(!reachLeft){
pixelStack.push([x - 1, y]);
reachLeft = true;
}
}
else if (reachLeft)
{
reachLeft = false;
}
}

if(x < canvasWidth-1)
{
if(matchStartColor(pixelPos + 4))
{
if(!reachRight)
{
pixelStack.push([x + 1, y]);
reachRight = true;
}
}
else if(reachRight)
{
reachRight = false;
}
}

pixelPos += canvasWidth * 4;
}
}

// now recolor all that shitty purple
for (var y=0; y < canvasHeight; y++)
for (var x=0; x < canvasWidth; x++)
{
var pixelPos = (y*canvasWidth + x) * 4;
if (colorLayer.data[pixelPos]===197 && colorLayer.data[pixelPos+1]===82 && colorLayer.data[pixelPos+2]===142 && colorLayer.data[pixelPos+3]===223)
{
var ch = fillColorFunc(pixelPos,x,y);
colorLayer.data[pixelPos] = ch[0];
colorLayer.data[pixelPos+1] = ch[1];
colorLayer.data[pixelPos+2] = ch[2];
colorLayer.data[pixelPos+3] = ch[3];
}
}

context.putImageData(colorLayer, 0, 0);
element.card.markCanvasUsed();

function matchStartColor(pixelPos)
{
var r = colorLayer.data[pixelPos];
var g = colorLayer.data[pixelPos+1];
var b = colorLayer.data[pixelPos+2];
var a = colorLayer.data[pixelPos+3];

return (r===startR && g===startG && b===startB && a===startA);
}
console.log('bucket complete ' + (Date.now()-time) + 'ms ' + pops + ' pops');
allowundo(colorLayer);
}
}

function card_key_down(event)
{
// activeElement needs to be the stack, not an inner field...
if (event.metaKey) return;
//console.log('card key down ' + event.key);

var meta = event.metaKey || event.ctrlKey, tool = element.tool.toLowerCase();

if (tool=='text')
{
// typing is fine
return;
}
else if (tool=='browse')
{
//console.log(event);
var cefae = ContentEditableFix.ActiveElement();
if (cefae.nodeName != 'FIELD-PART') cefae = null;
//else if (event.key.substr(0,5)=='Arrow' && body.classList.contains('arrow-keys-in-text')) event.preventDefault();
//console.log('key event ' + event.code + '/' + event.key);

var ascii = { 'ArrowLeft': 28, 'ArrowRight': 29, 'ArrowUp': 30, 'ArrowDown': 31, 'Enter': 13, 'Tab': 9, 'Backspace': 8 }[event.key];

// if the keyDown message is passed to the simulator script, it will send returnKey, arrowKey, etc.
if (ascii || event.key.length == 1)
{
if (!cefae) event.preventDefault();	// if it's not in the field don't move the window or tab or whatever
XTalk.Send(cefae || element.card, 'keyDown', [ascii ? String.fromCharCode(ascii) : event.key]);
}

event.stopPropagation();
return;
}
else if (sel_element && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))
{
sel_element.left += (event.key=='ArrowLeft') ? -1 : (event.key=='ArrowRight') ? 1 : 0;
sel_element.top += (event.key=='ArrowUp') ? -1 : (event.key=='ArrowDown') ? 1 : 0;
}
else if (sel_element && event.key=='Backspace')
{
var target = sel_element, parent = target.parentNode, sibling = target.nextElementSibling;
if (window.NBU2) NBU2.RegisterAction(()=>{ parent.insertBefore(target, sibling); }, ()=>{ parent.removeChild(target); });
parent.removeChild(target);
element.selectedPart = null
}
else if (tool == 'select' && event.key=='Backspace')
{
if (element.currentLayer.pickItUp) element.currentLayer.pickItUp(true);
element.currentLayer.pickItUp = element.currentLayer.putItDown = null;
element.currentLayer.moveSelAnts(false); element.clearUserSelections();
}
/*else if (element.tool=='Browse' && !body.classList.contains('arrow-keys-in-text')
&& (event.key=='ArrowLeft' || event.key=='ArrowRight' || event.key=='ArrowUp' || event.key=='ArrowDown'))
{
XTalk.Send(element.card, 'arrowKey', [ event.key.substr(5).toLowerCase() ]);
}*/
/*/else if (!sel_element && event.key=='ArrowLeft' && !body.classList.contains('arrow-keys-in-text')) XTalk.Do('go prev');
else if (!sel_element && event.key=='ArrowRight' && !body.classList.contains('arrow-keys-in-text')) XTalk.Do('go next');
else if (!sel_element && event.key=='ArrowDown' && !body.classList.contains('arrow-keys-in-text')) XTalk.Do('go back'); */
else if (sel_element && event.key=='Enter') launch_info_dialog(sel_element);
else if (sel_element && event.key=='Escape') element.clearUserSelections();
/*else if (!meta) {
console.log('sending keydown ' + event.key);
XTalk.Send(sim.card, 'keyDown', [event.key=='Enter'?'\n':event.key]);
element.focus(); event.preventDefault(); return;
}*/
/*else if (!meta && (document.activeElement===body || document.activeElement===sim.stack) && !messagebox.contains(document.activeElement)) {
// send it to the stack. no this is weirding out blindtyping, gotta check, not sure. might be much easier to put the key and set the selection if it doesn't pass
window.passedKeyDown = false;
XTalk.Send(sim.card, 'keyDown', [event.key]);
event.stopPropagation();
}*/

if (event.stopPropagation) { event.stopPropagation(); event.preventDefault();  }
return true;
}

element.addEventListener(('ontouchstart' in document) ? 'touchstart' : 'mousedown', (event)=>{
//console.log(event.composedPath()[0]);
var card = element.partOfEvent(event, 'card-part');
//console.log(card);
//	alert(card.name);
//	console.log(card, element.partOfEvent(event).closest('card-part'));
//				var card = event.target.closest('stack-part > card-part');
if (card && card.matches('.current')) card_mouse_down(event);
},true);

var mousecurrent = null;
element.addEventListener('mousemove', (event)=>{
var mouseloc = stackpoint(event);
sim.mouseLoc = Math.round(mouseloc.x)+','+Math.round(mouseloc.y);

var part = element.partOfEvent(event, 'button-part,field-part');
//console.log(part);

//console.log(element.isProcessingMouseDown)
if (!element.isProcessingMouseDown && element.tool=='Browse' && (!body.qs('#toolbar') || !body.matches('.command.option')))
{
if (mousecurrent !== part) {
if (mousecurrent)
XTalk.Send(mousecurrent, 'mouseLeave', [], (success)=>{
if ((mousecurrent=part) && success)
XTalk.Send(mousecurrent, 'mouseEnter');
});
else if (mousecurrent=part)
XTalk.Send(mousecurrent, 'mouseEnter');
}

if (mousecurrent)
XTalk.Send(mousecurrent, 'mouseWithin');
}
},true);

element.tabIndex=0;
function stackresize() {

element.style.setProperty('--card-width', element.width + 'px');
element.style.setProperty('--card-height', element.height + 'px');

/*	var w = number(element.getAttribute('width')), h = number(element.getAttribute('height'));
if (element.getAttribute('width')) element.style.setProperty('--card-width', w && w+'px' || '');
if (element.getAttribute('height')) element.style.setProperty('--card-height', h && h+'px' || '');*/
element.dispatchEvent(new Event('windowmoved', { bubbles: true }));
}
stackresize();

if (document.readyState == 'loading')
document.addEventListener('DOMContentLoaded', dcl, true);
function dcl(event) {
document.removeEventListener('DOMContentLoaded',dcl);
if (!currentCard)
element.card = element.card;
}

element.style.setProperty('--stack-button-font', element.buttonCSSFont);
element.style.setProperty('--stack-field-font', element.fieldCSSFont);

element.recently_visited_cards = [];
element.recently_visited_cards.lock_recent_cards = false;

var stackQueue = new XTalkQueue(), waitingTimeout = null;
stackQueue.Stack = element;
stackQueue.stateChangeWatcher = function(inprocess) {
// this messed up clicks obviously in retrospect
//if (element.parentNode) element.parentNode.classList.toggle('waiting', inprocess);

if (!inprocess) {
// this should all be on the stack, not the sim!
delete sim.itemDelimiter;
element.visualEffect = '';
element.mouseClick = '';
sim.lockMessages = false;
}
}

var currentCard = null;
return {
queue()
{ return stackQueue; },
card_key_down,
card_mouse_down,
paint_mouse_down,
partOfEvent(event, selectors) {
// trace the target to the containing field, button, or card
var target = event.composedPath()[0];
//console.log(target);
while (target) {
if (target instanceof ShadowRoot) target = target.host;
else if (!target.closest) { target = target.parentNode; }
else if (target.matches(selectors || 'button-part,field-part,card-part,background-part')) { break; }
else if (target.slot && target.assignedSlot) { target = target.assignedSlot; }
else { target = target.parentNode; }
}
return target;
},
clickDrag(startx, starty, stopx, stopy, modifiers)
{
var bcr = element.getBoundingClientRect();
var startevent = new MouseEvent('simulateddown', { bubbles: true,
clientX: bcr.x + startx/element.width*bcr.width, clientY: bcr.y + starty/element.height*bcr.height });
startevent.simulatedStackPoint = { x: startx, y: starty };
var stopevent = new MouseEvent('simulatedup', { bubbles: true,
clientX: bcr.x + stopx/element.width*bcr.width, clientY: bcr.y + stopy/element.height*bcr.height });
stopevent.simulatedStackPoint = { x: stopx, y: stopy };
card_mouse_down(startevent);
document.dispatchEvent(stopevent);
},
get size() { return JSON.stringify(element.savableJSON).length; },
get freeSize() { return 0; },
set buttonCSSFont(value) { element.style.setProperty('--stack-button-font', element.buttonCSSFont); },
set fieldCSSFont(value) { element.style.setProperty('--stack-field-font', element.fieldCSSFont); },
set visualEffect(value) { },
set width(value) { stackresize(); },
set height(value) { stackresize(); },
set name(value) { },
toString()
{
return element.longName;
},
get background() { return element.card.background; },
get card()
{ return currentCard || element.qs('card-part.current') || element.firstCard; },
set card(card) {
if (!card) throw "Can't find that card";
if (card.closest('stack-part') !== element) throw "Not a card in this stack";
if (card===currentCard) return;
//console.log('going to card id ' + card.id);
var was_currentCard = currentCard;
if (!!(currentCard=element.card))
{
if (was_currentCard && 'push_recent_card' in window && !recent_cards.lock_recent_cards)
push_recent_card(currentCard);

//var md = element.closest('#stackcontainer > modal-dialog');
//if (md && md.enable_mutation_observer)
//	md.enable_mutation_observer(false);	// turn off the mutations observer . Changing cards by itself shouldn't trigger a save.

currentCard.classList.remove('current', 'forward-card', 'back-card');

// push the card we're leaving IF we're not going back
if (was_currentCard && !element.recently_visited_cards.lock_recent_cards) {

element.recently_visited_cards.push(currentCard);
if (element.recently_visited_cards.length > 40)
element.recently_visited_cards.shift();
}

// want to find animation that works for better control than transitions!
if (element.visualEffect)
{
((cc, tc)=>{
var el = cc.addEventListener('transitionend', (event)=>{
if (event.propertyName!='transform') return;
cc.removeEventListener('transitionend',el);
element.visualEffect = '';
cc.classList.remove('forward-card','back-card');
//console.log('effect done',cc.className);
});
cc.classList.add('forward-card');
})(currentCard, card);
}

/*if (md && md.enable_mutation_observer)
md.enable_mutation_observer(true);*/
}

element.clearUserSelections();
//if (md && md.enable_mutation_observer)
//	md.enable_mutation_observer(false);	// turn off the mutations observer . Changing cards by itself shouldn't trigger a save.

var s = parseFloat(getComputedStyle(element).getPropertyValue('--visual-effect-duration'));
s = (!isNaN(s) ? s : 0) * 1000;
function setHideTimeout(card, install)
{
if (card.hide_timeout)
{ clearTimeout(card.hide_timeout); delete card.hide_timeout; }
if (install) {
if (s)
card.hide_timeout = setTimeout(()=>{ card.prepareToHide(); }, s);
else
card.prepareToHide();
}
}

setHideTimeout(currentCard, true);

(currentCard=card).classList.add('current');
//if (md && md.enable_mutation_observer)
//	md.enable_mutation_observer(true);

setHideTimeout(currentCard, false);

var bkgnd = card.bkgndID && element.qs(`:scope > background-part[ID="${card.bkgndID}"]`);

if (!bkgnd) 	// the actual background element
throw "card id " + card.ID + " has no background id " + card.bkgndID;

// okay, the true means that it's always gonna make a new clone of the background when the card is prepared. This is needed for
// visual effects, but could make something weird or slow. Verified that background card text still works.
if (true || !bkgnd.cloned_node)
{
// maybe it would be easier to make two background clones period and switch between as needed

var srcbkgnd = bkgnd.cloned_node || bkgnd;

//if (bkgnd.cloned_node) console.log('loading from a clone'); else console.log('loading from the original');

// I need to put the cloned_node in there BEFORE cloning so icons know where they're coming from ! otherwise stackOf is wrong during startup, when the stack that is in front may not be the one loading.
(bkgnd.cloned_node=srcbkgnd.cloneNode(true)).clone_of = bkgnd;	// ok the clone node could use links back to the original for the field maybe
bkgnd.cloned_node.card_for_bkgnd_clone = card;

// what does it take to insta-load an img in Safari? Chrome doesn't have any trouble.
// stealing the background images from the old one is not so bad; there is a small flicker during the visual effect slide though.
var iconButtons = bkgnd.cloned_node.qsa('button-part[icon]').forEach((btn)=>{
var fromBtn = srcbkgnd.childNodes[Array.from(btn.parentNode.childNodes).indexOf(btn)] /*srcbkgnd.qs('button-part[icon="' + btn.icon + '" i]')*/, fromImg, toImg;
if (fromBtn && fromBtn.shadowRoot && (fromImg=fromBtn.shadowRoot.qs('#icon img')) && fromImg.getAttribute('src')
&& btn.shadowRoot && (toImg=btn.shadowRoot.qs('#icon img'))) {
var clone = fromImg.cloneNode();
fromImg.parentNode.insertBefore(clone, fromImg);
clone.style.width = fromImg.offsetWidth ? fromImg.offsetWidth + 'px' : '';
clone.style.height = fromImg.offsetHeight ? fromImg.offsetHeight + 'px' : '';
clone.style.background = 'url(' + fromImg.src + ')';
toImg.parentNode.replaceChild(fromImg,toImg);
//							console.log('cloned ' + (toImg.src=fromImg.src));
}
});

var bitmap = srcbkgnd.savableJSON.bitmap;

bkgnd.cloned_node.qsa('field-part:not([sharedText="true" i])').forEach((bgfld)=>{
bgfld.assumeBkgndFieldDuty();
});
if (bitmap)
bkgnd.cloned_node.card_bitmap_to_load = { dataURL: bitmap, WOBA: (srcbkgnd.card_bitmap_to_load || {}).WOBA };
//if (srcbkgnd.bitmap)
//	bkgnd.cloned_node.bitmap = srcbkgnd.bitmap;

makeclonemutationobserver(bkgnd);
function makeclonemutationobserver(savebkgnd)
{
new MutationObserver((mlist)=>{
//	console.log(mlist);
//	console.log('mutated bkgnd clone',mlist);
savebkgnd.setAttribute('data-mutator', Date.now()); 	// is this working??
//if (element.closest('modal-dialog') && element.closest('modal-dialog').mo_callback)
//	element.closest('modal-dialog').mo_callback(mlist);	// will this work?
}).observe(bkgnd.cloned_node, {childList: true, attributes: true, attributeOldValue: true, characterData: true, subtree: true});
}

}

bkgnd.cloned_node.qsa('field-part:not([sharedText])').forEach((bgfld)=>{
var slotname = '-'+bgfld.id, target_slot;
if (!(target_slot=currentCard.qs(`:scope > div[slot="${slotname}"]`)))
{
target_slot = document.createElement('div');
target_slot.slot = slotname;
currentCard.insertBefore(target_slot, currentCard.firstChild);
}
});

if (currentCard.internalBkgnd)
currentCard.internalBkgnd.parentNode.removeChild(currentCard.internalBkgnd);
currentCard.shadowRoot.qs('span.background').parentNode.insertBefore((currentCard.internalBkgnd=bkgnd.cloned_node), currentCard.shadowRoot.qs('span.background'));
// mutual background editing. for now let's just have savableJSON save the clone instead

bkgnd.cloned_node.prepareToShow();

element.refreshAddColorStage();

card.prepareToShow();

element.dispatchEvent(new Event('openCard', { bubbles: true }));
element.checkIfIdleMessagesAllowed();
},
refreshAddColorStage()
{
var card = element.card, bkgnd = element.background, hasAddColorData,
bkgndCSS = bkgnd.produceAddColorCSS(element.localPICTs), cardCSS = card.produceAddColorCSS(element.localPICTs),
useAddColorData = {
'--colorData-background-for-bkgnd': bkgndCSS.background,
'--colorData-background-size-for-bkgnd': bkgndCSS.size,
'--colorData-background-blend-mode-for-bkgnd': bkgndCSS.blendMode,
'--colorData-background-for-card': cardCSS.background,
'--colorData-background-size-for-card': cardCSS.size,
'--colorData-background-blend-mode-for-card': cardCSS.blendMode
};
for (var acd in useAddColorData) {
card.shadowRoot.qs('#cardcolor').style.setProperty(acd, useAddColorData[acd]);
//hasAddColorData = hasAddColorData || !!useAddColorData[acd];
}
hasAddColorData = card.addColorData || bkgnd.addColorData;	// have an AddColor stage mode
if (hasAddColorData) {
card.shadowRoot.qs('#cardcolor').setAttribute('hasAddColorData', 'true');
card.shadowRoot.qs('div.display').setAttribute('hasAddColorData', 'true');
}
else {
card.shadowRoot.qs('#cardcolor').removeAttribute('hasAddColorData');
card.shadowRoot.qs('div.display').removeAttribute('hasAddColorData');
}
},
GoCoroutine:function*(card)
{
var goingBack = (card=='back');
if (goingBack) {
card = element.recently_visited_cards.pop();
if (!card) return;
}

if (element.card===card) return;

if (element.card.contains(document.activeElement))
document.activeElement.blur();

var changeBkgnd = (element.card.background !== card.background);
if (!sim.lockMessages)
{
yield*xtalk_send_coroutine('closeCard', [], element.card);
if (changeBkgnd)
yield*xtalk_send_coroutine('closeBackground', [], element.card);
}


element.recently_visited_cards.lock_recent_cards = goingBack;
element.card = card;
element.recently_visited_cards.lock_recent_cards = false;

if (!sim.lockMessages)
{
if (changeBkgnd)
yield*xtalk_send_coroutine('openBackground', [], card);
yield*xtalk_send_coroutine('openCard', [], card);
}

var s = parseFloat(getComputedStyle(element).getPropertyValue('--visual-effect-duration'));
s = (!isNaN(s) ? s : 0) * 1000 + 20;
yield({timeout: s });
/*if (element.visualEffect)
yield({timeout: 250});*/

// should not return from the script until the visual effect is over.
// however this allows CSS to highlight buttons in the meantime.
/*if (element.visual_effect_arrival) {
var xtqas = XTalkQueue.Active.Service;
element.visual_effect_arrival = ()=>{ xtqas(); };
yield({timeout: -1});
}*/

//element.checkIfIdleMessagesAllowed();
},
get currentLayer()
{ return element.classList.contains('background-mode') ? element.background : element.card; },
get recentCard() 	// this doesn't pop, so go backCard isn't really go back
{ return element.recently_visited_cards[element.recently_visited_cards.length-1] || stackcontainer.qs('modal-dialog[ID="1"] card-part'); },
get firstCard()
{ return element.qs('card-part:nth-of-type(1)'); },
get firstMarkedCard()
{ return element.qs('card-part[marked]:not([marked="false" i])'); },
get lastCard()
{ return element.qs('card-part:last-of-type'); },
get lastMarkedCard() {
var last = element.lastCard;
while (last && !(last.matches && last.matches('card-part[marked]:not([marked="false" i])')))
last = last.previousSibling;
return last;
},
get nextCard()
{ return element.qs('card-part.current ~ card-part') || element.firstCard; },
get nextMarkedCard()
{ return element.qs('card-part.current ~ card-part[marked]:not([marked="false" i])') || element.firstMarkedCard; },
get prevCard() {
var prev = element.card;
while ((prev=prev.previousSibling) && !(prev.matches && prev.matches('card-part'))) {}
return prev || element.qs('card-part:last-of-type');
},
get prevMarkedCard() {
var prev = element.card;
while ((prev=prev.previousSibling) && !(prev.matches && prev.matches('card-part[marked]:not([marked="false" i])'))) {}
return prev || element.lastMarkedCard;
},
cardOf(ordinal, marked, bkgnd) {
var descriptor = 'card-part' + (bkgnd ? '[bkgndID="'+bkgnd.id+'"]' : '') + (marked ? '[marked]:not([marked="false" i])' : '');

if (ordinal === 'next')
return element.qs(':scope > card-part.current~'+descriptor) || element.qs(':scope > '+descriptor);

if (ordinal === 'prev') {
var prev = currentCard;
while (prev=prev.previousSibling)
if (prev.matches && prev.matches(descriptor))
return prev;
prev = element.lastChild;
do {
if (prev.matches && prev.matches(descriptor))
return prev;
} while ((prev!==currentCard) && (prev=prev.previousSibling));

return null;
}

var cards = element.qsa(':scope > ' + descriptor);

if (ordinal==='last')
return cards[cards.length-1];
if (ordinal==='middle')
return cards[Math.floor(cards.length/2)];
if (ordinal==='any')
return cards[Math.floor(Math.random()*cards.length)];
if (ordinal==='number')
return cards.length;

ordinal=number(ordinal);
return cards[ordinal-1];
},
backgroundOf(ordinal) {
var descriptor = 'background-part';

if (ordinal === 'next')
return element.qs(':scope > background-part[id=\"'+(currentCard.background.ID)+'\"]~'+descriptor) || element.qs(':scope > '+descriptor);

if (ordinal === 'prev') {
var currentBkgnd = currentCard.background.clone_of, prev = currentBkgnd;
while (prev=prev.previousSibling)
if (prev.matches && prev.matches(descriptor))
return prev;
prev = element.lastChild;
do {
if (prev.matches && prev.matches(descriptor))
return prev;
} while ((prev!==currentBkgnd) && (prev=prev.previousSibling));

return null;
}

var bkgnds = element.qsa(':scope > ' + descriptor);

if (ordinal==='last')
return bkgnds[bkgnds.length-1];
if (ordinal==='middle')
return bkgnds[Math.floor(bkgnds.length/2)];
if (ordinal==='any')
return bkgnds[Math.floor(Math.random()*bkgnds.length)];
if (ordinal==='number')
return bkgnds.length;

ordinal=number(ordinal);
return bkgnds[ordinal-1];
},
newCard(newBackground) {
var target = document.createElement('card-part'), maxid = 0, bkgndID = currentCard.bkgndID;
element.qsa(':scope > card-part').forEach((e)=>maxid=Math.max(maxid,Number(e.id)||0));
target.id = maxid + 1;
if (newBackground)
{
var newbg = document.createElement('background-part');
maxid = 0;
element.qsa(':scope > background-part').forEach((e)=>maxid=Math.max(maxid,Number(e.id)||0));
newbg.id = bkgndID = (maxid+1);
element.insertBefore(newbg, currentCard.nextSibling);
}
target.bkgndID = bkgndID;
element.insertBefore(target, currentCard.nextSibling);
element.card = target;
return target;
},
deleteCard(target) {
if (target.cantDelete) throw "Can't delete card because cantDelete property is true.";
if (element.card === target)
element.card = element.qs('card-part.current + card-part') || element.prevCard;
if (element.card === target) throw "Can't delete last card of stack.";
element.removeChild(target);
},
pushCard(card) {
if (!element.pushedCards) element.pushedCards = [];
element.pushedCards.push(card);
//console.log('card pushed',card);
},
popCard() {
var card = (element.pushedCards ? element.pushedCards.pop() : null) || element.firstCard;	// instead of the home stack , just pop the first card
//console.log('card popped', card);
return card;
},
get selectedPart()
{ return sel_element; },
set selectedPart(target) {

//template.qs('marching-ants').inset = 0;
template.qs('marching-ants').setTarget(target, element);
sel_element = target;
if (ContentEditableFix.ClosestEditable(target)) {
getSelection().setBaseAndExtent(target.parentNode, Array.from(target.parentNode.childNodes).indexOf(target), target.parentNode,Array.from(target.parentNode.childNodes).indexOf(target)+1);
/*if (document.activeElement !== closest_editable_container(target))
closest_editable_container(target).focus();*/
} else {
getSelection().removeAllRanges();
//element.focus();	// this is not perfect, want to untangle blindtyping in the message box and forward events
}
},
set tool(value) {
element.clearUserSelections();
element.refreshAddColorStage();
element.checkIfIdleMessagesAllowed();
},
get localICONs() {
if (!element.importedICONs && !element.importedICONResources) return {};	// sometimes the import happens after init...
if (!element.importedICONImages)
{
element.importedICONImages = JSON.parse(element.importedICONs || '{}');
Object.assign(element.importedICONImages, unpack_ICONs(JSON.parse(element.importedICONResources || '[]')));
}
return element.importedICONImages;
},
get localPICTs() {
if (!element.importedPICTs) return [];	// sometimes the import happens after init...
if (!element.importedPICTImages)
element.importedPICTImages = JSON.parse(element.importedPICTs);
return element.importedPICTImages;
},
get localCURSs() {
if (!element.importedCURSs) return [];	// sometimes the import happens after init...
if (!element.importedCURSImages)
element.importedCURSImages = JSON.parse(element.importedCURSs);
return element.importedCURSImages;
},
get localWAVs() {
if (!element.importedWAVs) return [];	// sometimes the import happens after init...
if (!element.importedWAVSounds) {
element.importedWAVSounds = {};
var wavs = JSON.parse(element.importedWAVs);
if (wavs.length) console.log('sounds in stack: ' + Object.keys(wavs).join(', '));
for (var wav in wavs)
element.importedWAVSounds[String(wav).toLowerCase()] = loadBase64Sound(wavs[wav], ()=>console.log('could not decode sound '+wav));
}
return element.importedWAVSounds;
},
importedAttributes() {
// there are others but these go at the end
return ['importedICONResources','importedICONs','importedWAVs','importedPLTEs','importedPICTs','importedCURSs','buttonCSSFont','fieldCSSFont','version'];
},
get savableJSON() {
var out = { $:'stack-part', name:element.name, width:element.width, height:element.height, script:element.script||'',
$$:Array.from(element.qsa(':scope > card-part, :scope > background-part')).map((c)=>{
if (c.cloned_node) {
//c.cloned_node.savableJSON_request_clone = true;
return c.cloned_node.savableJSON;
}
return c.savableJSON;
}) };
element.importedAttributes().forEach((a)=>{
if (element[a])
out[a] = element[a];
});
return out;
},
set savableJSON(json) {
currentCard = null;
element.width = parseInt(json.width) || 512;
element.height = parseInt(json.height) || 342;
if (json.script)
element.script = json.script;
element.importedAttributes().forEach((a)=>{
if (json[a])
element[a] = json[a];
});
var initWAVs = element.localWAVs;	// inits the sound

var maxid = 0;
(json.$$||[]).forEach((c)=>{ if (c.$ && c.$.toLowerCase()=='card-part') maxid = Math.max(maxid, Number(c.id)||0); });
(json.$$||[]).forEach((c)=>{ if (c.$ && c.$.toLowerCase()=='card-part' && !c.id && !c.ID && !c.iD && !c.Id)
{ c.id = ++maxid; console.log('tagging card with id '+maxid); } });

element.innerHTML = '';
readchildren(element,json);
element.card = element.card;
//console.log(element.card);
Array.from(element.qsa('card-part')).map((c)=>c.classList.toggle('current', c===element.card));
Array.from(element.qsa('card-part')).map((c)=>c.classList.remove('forward-card'));

function readchildren(node,json) {

(json.$$||[]).forEach((json)=>{
if (json && typeof json === 'object' && json.$) {
var child = document.createElement(json.$);
// we can't uncomment this because it puts a spurious line in the field when it's connected.
// we'd like to though because then the xTalk can see where it errors when compiled.
//node.appendChild(child);	// Safari debugger?
Object.keys(json).forEach((key)=>{
if (key.toLowerCase()=='class') child.className = json[key];
else if (['card-part','background-part'].includes(json.$.toLowerCase()) && key.toLowerCase()=='bitmap')
child.card_bitmap_to_load = { dataURL: json[key] };
else if (['card-part','background-part'].includes(json.$.toLowerCase()) && key.toLowerCase()=='woba')
child.card_bitmap_to_load = { WOBA: json[key] };
if (key[0]!='$') try { child.setAttribute(key,json[key]); } catch(e) { console.log('setAttribute '+key,e); }
});
readchildren(child,json);
node.appendChild(child);	// Safari debugger?

}
else
node.appendChild(document.createTextNode(json));
});
}
},
get savableHTML() {
var stackjson = element.savableJSON;

element.importedAttributes().forEach((a)=>{
if (element[a])
stackjson[a] = element[a];
});

if (element.localICONs.length)
{
var expandedICONsList = Object.assign({},element.localICONs);	// start with shallow copy
element.querySelectorAll('button-part[icon]').forEach((btn)=>{
if (!expandedICONsList[String(btn.icon)])
expandedICONsList[String(btn.icon)] = exportimage(btn.shadowRoot.qs('#icon img'));
});
stackjson.importedICONs = JSON.stringify(expandedICONsList);
}
function exportimage(img) {
var canvas = document.createElement('canvas');
canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
var ctx = canvas.getContext('2d');
ctx.drawImage(img,0,0);
return canvas.toDataURL('image/gif');
}

return better_emit_json_as_html(stackjson,1);
},
replaceAllContents(ds) {
element.innerHTML='';
element.appendChild(ds);
currentCard = null;
element.card = element.card;
},
clearUserSelections() {
element.selectedPart = null;
element.polygonDragInProgress = false;
var layer = element.currentLayer;
if (layer) {
if (layer.putItDown) { layer.putItDown(); delete layer.putItDown; }
delete layer.pickItUp;
layer.moveSelAnts(false);
}
},
checkIfIdleMessagesAllowed() {

// problem: idle is sent to card with no handler. then card changes. idle callback reports no idle, but we need to check again! soluton: just kill the timeout
var allow = (element===sim.stack
&& !(element.parentNode && element.parentNode.classList && element.parentNode.classList.contains('loading'))
&& !element.isProcessingMouseDown
&& element.tool=='Browse'
&& !(window.scripteditor && scripteditor.visible));
//console.log('idle allowed = ' + allow + ' on card ' + (sim.card && sim.card.name) + ', timer=' + element.idleTimer);
if (!allow && element.idleTimer)
{ clearTimeout(element.idleTimer); element.idleTimer = null; }
else if (allow /*&& !element.idleTimer*/) {
clearTimeout(element.idleTimer);
element.idleTimer = setTimeout(()=>{
//console.log('idle');
if (element===sim.stack && !element.isProcessingMouseDown && element.tool=='Browse' && !(window.scripteditor && scripteditor.visible)) {
//console.log('sending idle to card ' + (sim.card && sim.card.name) + ', timer=' + element.idleTimer);
XTalk.Send(sim.card, 'idle', [], (success)=>{ /*console.log('idle success ' + success);*/ element.idleTimer = null; if (success) { element.checkIfIdleMessagesAllowed(); } }, false, true);
}
else element.checkIfIdleMessagesAllowed();
}, 1);
}
}
};
}
ElementTemplate.Create("stack-part", "width=512,height=342,tool=Browse,visualEffect='',importedICONs,importedICONResources,importedWAVs,importedPLTEs,importedPICTs,importedCURSs,importedColorData,buttonCSSFont,fieldCSSFont", "xtalk-common-template",`<slot></slot><marching-ants inset="0"></marching-ants><style>
:host
{
display: inline-block;
position: relative;
background: white;
--pointer-cursor: url(ui-icons/BrowseCursor.bmp) 6 0;
cursor: var(--pointer-cursor), pointer;
xcontain: paint size style; /* layout triggers 4px margin below us */

}
</style>`);

"use strict";
var grayPngImg = new Image();
grayPngImg.src = "ui-icons/gray.png";
function set_gray_pattern(src)
{
grayPngImg.src = src || "ui-icons/gray.png";
}

function card_or_background_template(element,template)
{
var canvas, context2d, dpr = Math.round(window.devicePixelRatio||1);
template.qs('#cardcolor').style.setProperty('--background', element.color);

// we can't do this here because at this point the template's <marching-ants> apparently hasn't been initialized at this time
//template.qs('marching-ants').setTarget(template.qs('canvas#select'));

return {
prepareToShow()
{
// card_bitmap_to_load used
//if (element.name == 'A') debugger;
//console.log('showing',element);

var bitmap = (element.card_bitmap_to_load && element.card_bitmap_to_load.dataURL) || element.bitmap;
if (bitmap) {
var loader_img = new Image;
loader_img.onload = function() {
// there's an annoying flicker while it 'loads' why does it have to load from local base64 anyway?
if (!element.parentNode) return;	// the card was created but then destroyed
element.canvasContext2d.drawImage(this, 0, 0, this.width, this.height, 0, 0, this.width/dpr, this.height/dpr);
element.canvas.image_is_present = true;
}
loader_img.src = bitmap;
//delete element.card_bitmap_to_load.dataURL;
}
else if (element.card_bitmap_to_load && element.card_bitmap_to_load.WOBA) {
renderWOBA(element.card_bitmap_to_load.WOBA, element.canvasContext2d, dpr);
//if (element.name == 'A') debugger;
}
else if (element.hasAttribute('WOBA')) {
element.card_bitmap_to_load = { WOBA: element.getAttribute('WOBA').split(',').map((a,i)=>(i<12)?Number(a):a) };
renderWOBA(element.card_bitmap_to_load.WOBA, element.canvasContext2d, dpr);
}

if (element.matches('card-part') && element.background) {
//console.log('prepareToShow',element,element.background,element.background.qsa('button-part[id][sharedHilite="false" i]'));
// default is sharedHilite, we're looking for not sharedhilite

element.background.qsa('button-part[id][sharedHilite="false" i]').forEach((b)=>{
//console.log(b, element.qs('div[slot="-' + b.id +'"]'));
// oh great, now the btns and fields need different ids...hmm well in HC they do anyway...need ID creation
b.hilite = !!element.qs('div[slot="-' + b.id +'"]');
});
}

if (element.qs('video')) element.qs('video').load();
if (element.qs('audio')) element.qs('audio').load();
},
prepareToHide()
{
//console.log('hiding',element);
if (template.qs('canvas.canvas'))
{
// need to copy back canvas?
var span = document.createElement('span');
span.className = 'canvas';
template.qs('canvas.canvas').parentNode.replaceChild(span,template.qs('canvas.canvas'));
}
canvas = context2d = null;

var select = template.qs('canvas#select');
select.width = select.height = 0;
select.getContext("2d").clearRect(0,0,1,1);

if (element.internalBkgnd) {
element.internalBkgnd.prepareToHide();
element.internalBkgnd.parentNode.removeChild(element.internalBkgnd);
}
delete element.internalBkgnd;
},
connected()
{
},
toString()
{
return element.longName;
},
set color(value) {
template.qs('#cardcolor').style.setProperty('--background', element.color);
//template.qs('#cardcolor').style.background = value;
},
set addColorData(value) {
var stack = sim.stackOf(element,true);
if (stack && (stack.card===element || stack.background===element))
stack.refreshAddColorStage();
},
produceAddColorCSS(localPICTs) {	// pass in stack.localPICTs[]
var cssB = [], cssBS = [], cssBBM = [];
JSON.parse(element.addColorData || '[]').forEach((obj)=>{
if (obj.type=='rectangle')
cssB.push('linear-gradient(to bottom, ' + obj.color + ' 0% , ' + obj.color + ' 100%) ' + obj.left + 'px ' + obj.top + 'px no-repeat');
else if (obj.type=='picture') {
// new import stores pict by ID with .name, older import stored pict by name with .ID
var pict=null;
for (var p in localPICTs)
if (localPICTs[p].name && localPICTs[p].name.toLowerCase()==obj.name.toLowerCase()) { pict = localPICTs[p]; break; }
if (!pict)
pict = localPICTs[obj.name];
cssB.push('url('+(pict ? pict.bitmap : '')+')' + ' ' + obj.left + 'px ' + obj.top + 'px no-repeat');
}
else return;
cssBS.push((obj.right-obj.left) + 'px ' + (obj.bottom-obj.top) + 'px');
cssBBM.push((obj.type=='picture' && obj.transparent) ? 'multiply' : 'normal');
});
element.qsa(':scope > button-part[color], :scope > field-part[color]').forEach((p)=>{
if (!p.visible) return;
var bevel = Math.abs(parseInt(p.bevel)), obj = { color: p.color, left: p.left+bevel, top: p.top+bevel, right: p.right-bevel, bottom: p.bottom-bevel };
cssB.push('linear-gradient(to bottom, ' + obj.color + ' 0% , ' + obj.color + ' 100%) ' + obj.left + 'px ' + obj.top + 'px no-repeat');
cssBS.push((obj.right-obj.left) + 'px ' + (obj.bottom-obj.top) + 'px');
cssBBM.push((obj.type=='picture' && obj.transparent) ? 'multiply' : 'normal');
});
return { 'background': cssB.reverse().join(', '), 'size': cssBS.reverse().join(', '), 'blendMode': cssBBM.reverse().join(', ') };
},
get canvas() {
if (!canvas) {
template.qs('span.canvas').parentNode.replaceChild((canvas=document.createElement('canvas')),template.qs('span.canvas'));
canvas.className = 'canvas';
if (element.nodeName.toLowerCase()=='background-part') canvas.style.zIndex = -1;

canvas.style.width = element.width;
canvas.style.height = element.height;
canvas.width = element.width * dpr;
canvas.height = element.height * dpr;
//if (element.name=='A') debugger;

context2d = canvas.getContext('2d', { willReadFrequently: true, antialias: false });
context2d.lineWidth = 1;
context2d.strokeStyle = 'black';
context2d.scale(dpr,dpr);
context2d.imageSmoothingEnabled = true;
}
return canvas;
},
get canvasContext2d() {
if (!context2d)
{
context2d = element.canvas.getContext("2d");
context2d.gray_src = grayPngImg.src;
context2d.gray_pattern = context2d.createPattern(grayPngImg, "repeat");
//context2d.globalCompositeOperation = 'source-over';
/*const img = new Image();
img.src = "ui-icons/gray.png";
img.onload = () => {
context2d.gray_pattern = context2d.createPattern(img, "repeat");
};*/
}
if (context2d.gray_src !== grayPngImg.src)
{
//console.log('recreating gray pattern');
context2d.gray_pattern = context2d.createPattern(grayPngImg, "repeat");
}

return context2d;
},
moveSelAnts(show, left, top, width, height) {
var select = template.qs('canvas#select'), stack = element.closest('stack-part') || element.getRootNode().host.closest('stack-part');
select.style.display = show ? 'initial' : 'none';
stack.shadowRoot.qs('marching-ants').setTarget(show && select);
stack.shadowRoot.qs('marching-ants').visible = show;
if (show) {
select.style.left = left+'px';
select.style.top = top+'px';
select.width = width * (window.devicePixelRatio||1);
select.height = height * (window.devicePixelRatio||1);
select.style.width = width+'px';
select.style.height = height+'px';
}
},
get savableJSON() {
var out = sanitary(element);
delete out.woba;
if (element.card_bitmap_to_load && element.card_bitmap_to_load.WOBA)
out.WOBA = element.card_bitmap_to_load.WOBA;
else if (canvas && canvas.image_is_present) {
if (element.putItDown) {
var savecanvas = document.createElement('canvas');
savecanvas.width = canvas.width; savecanvas.height = canvas.height;
var saveContext = savecanvas.getContext('2d');
saveContext.drawImage(canvas,0,0);
saveContext.scale(dpr,dpr);
saveContext.imageSmoothingEnabled = true;
element.putItDown(false,saveContext);
out.bitmap = savecanvas.toDataURL();
}
else if (false && element.putItDown) {
// again it seems reasonable to control the process of saving canvas snapshots for undos
console.log(1);
var imgData = context2d.getImageData(0,0,canvas.width,canvas.height);
console.log(2);
element.putItDown(false);
console.log(3);
out.bitmap = canvas.toDataURL();
console.log(4);
context2d.putImageData(imgData,0,0);	// CRASH!
console.log(5);
}
else out.bitmap = canvas.toDataURL('image/gif');
}
return out;
function sanitary(node) {
var out = {$:node.nodeName.toLowerCase()};
Array.from(node.attributes).forEach((attr)=>{
var key = attr.name.toLowerCase();
if (key.substr(0,2)=='on' || key=='style' || key=='data-mutator' || key=='contenteditable') return;	// really want to exclude all nondeclared from -part types.
if (key=='src' && attr.value.substr(0,11).toLowerCase()=='javascript:') return;
out[key] = attr.value;
});
Array.from((node.shared_contents || node).childNodes).forEach((child)=>{
if (child.nodeType===1)
(out.$$=(out.$$||[])).push(sanitary(child));
else if (child.nodeType===3)
(out.$$=(out.$$||[])).push(child.nodeValue);
});
//if (node.shared_contents) console.log('serializing shared contents instead: ',node,node.shared_contents);
return out;
}
},
get savableHTML() {
return better_emit_json_as_html(element.savableJSON);
},
markCanvasUsed() {
if (canvas)
canvas.image_is_present = true;

// put all this in a timeout or something! it doesnt need to fire until the stack saves
if (element.clone_of)
delete element.clone_of.card_bitmap_to_load;
delete element.card_bitmap_to_load;

clearTimeout(element.canvasMutateTimeout);
element.canvasMutateTimeout = setTimeout(()=>{
//console.log('marked canvas mutated');
element.setAttribute('bitmap', element.savableJSON.bitmap || '');
element.setAttribute('data-mutator', Date.now()); 	// trigger mutation observer
}, 10);
},
fld(n) {
return element.qsa('field-part')[number(n)-1];
},
btn(n)
{ return element.qsa(element.qsa('button-part'))[number(n)-1]; },
part(n)
{ return element.qsa(element.qsa('button-part,field-part'))[number(n)-1]; },
get maxID() {
var maxid = 0;
element.qsa('button-part,field-part').forEach((e)=>maxid=Math.max(maxid,Number(e.id)||0));
return maxid;
},
/* would be nice to have some kind of interface that handles this stuff from rectangle */
get left() { return 0; },
get width() { return (element.clone_of || element).closest('stack-part').width; },
get right() { return (element.clone_of || element).closest('stack-part').width; },
get top() { return 0; },
get height() { return (element.clone_of || element).closest('stack-part').height; },
get bottom() { return (element.clone_of || element).closest('stack-part').height; },
get rect() { return [0,0,(element.clone_of || element).closest('stack-part').width,(element.clone_of || element).closest('stack-part').height]; },
get rectangle() { return [0,0,(element.clone_of || element).closest('stack-part').width,(element.clone_of || element).closest('stack-part').height]; }

}
}
ElementTemplate.Create("card-or-background-template", "color,ID=0,dontSearch=false,cantDelete=false,showPict=true,bitmap,addColorData=''", "xtalk-common-template",`<div id="cardcolor"></div><div class="display"><span class="background"></span><span class="canvas"></span><span class="text-tool-overlay"></span><canvas id="select" width="0" height="0"></canvas><slot></slot></div><style>
:host {
position: relative; display: inline-block;
--stack-or-card-width: calc(var(--stack-width, var(--card-width)));
--stack-or-card-height: calc(var(--stack-height, var(--card-height)));
touch-action: var(--tool-touch-action);
contain: paint size style; /* layout triggers 4px margin below us */
}
:host #cardcolor
{
position: absolute; left: 0; right: 0; top: 0; bottom: 0; z-index: -1; pointer-events: none;
}

:host div.display {
position: absolute;
left: 0;
top: 0;
right: 0;
bottom: 0;
padding: 0px; margin: 0px;
}
:host span.canvas, :host span.background {	/* stand in location for canvas if not used */
display: none;
}
:host canvas.canvas {
image-rendering: pixelated;
image-rendering: -moz-crisp-edges;
image-rendering: crisp-edges;
background: transparent;
position: absolute; left: 0px; top: 0px;
width: calc(var(--stack-or-card-width) - 0px); height: var(--stack-or-card-height);
pointer-events: none;
xmargin-right: -4px; xborder-right: 4px solid red;	/* This might fix Safari's bug with not drawing the backgrounds or beign in srcOr or something. However it stops working if the overflow is hidden. */
}

/* this gets the layering right, but now clicks in the background don't register */
/*:host(background-part)  { z-index: -1;  }
:host(background-part) canvas.canvas { xz-index: -1;  }
:host(card-part) canvas.canvas { z-index: -1; }*/
/* ok, leaving it alone right now, everything is good except the overflow is not hidden */

:host([showPict="false" i]) canvas.canvas {
display: none;
}
:host #select { /* the border appears below the image though when it's got a drag. Could fix with a container element with :after. It would make more sense to have <span class=select></span> and then put a canvas in there only when it's needed. */
position: absolute; left: 0px; top: 0px; width: 0px; height: 0px;
display: none;
z-index: 1;
}

</style>`);

document.write('<style>' + `

/*stack-part.background-mode > card-part {
--colorData-background-mode-url-empty: url();
}*/

card-part {
width: var(--stack-or-card-width);
height: var(--stack-or-card-height);
--first-field-line-line-height: 1;
}

card-part button-part { outline: var(--card-button-part-outline, var(--part-outline)); pointer-events: var(--card-or-bkgnd-part-pointer-events); cursor: var(--pointer-cursor), pointer; }
card-part field-part { outline: var(--card-field-part-outline, var(--part-outline)); pointer-events: var(--card-or-bkgnd-part-pointer-events); cursor: var(--pointer-cursor), pointer; }
stack-part[tool] > card-part field-part { outline: var(--card-field-part-outline, var(--part-outline)); pointer-events: var(--card-or-bkgnd-part-pointer-events); }
card-part a { pointer-events: var(--card-or-bkgnd-part-pointer-events); }
card-part > iframe { outline: thin solid gray; position: relative; }
card-part > video { position: relative; }

/* buttons inside fields make sense and carets work well */
field-part button-part:not([topLeft]) { margin: 0 1px 0 3px; vertical-align: middle; }

body stack-part:not([tool]) > card-part field-part button-part:not(topLeft]):not(:active) {
-webkit-user-select: all; user-select: all; x--background: transparent;
}

/* this one really works for bg flds with card text, but does nothing for shared text or card fields */
card-part > div[slot] > div:nth-of-type(1):first-line { xcolor: red; line-height: var(--first-field-line-line-height); }

/* this one works for card flds */
card-part field-part:not([fixedLineHeight]) > div:nth-of-type(1):first-line { xcolor: orange; line-height: var(--first-field-line-line-height); }

` + '</style>');
function card_part(element,template)
{
return {
get background() {
// returns the cloned node if it exists
var bg = element.bkgndID && element.closest('stack-part') && element.closest('stack-part').qs(`:scope > background-part[ID="${element.bkgndID}"]`);
return bg && (bg.cloned_node || bg);
},
get card() {
return element;
},
get owner() {
return this.background;
},
get number() {
return Array.from(element.closest('stack-part').qsa(element.nodeName)).indexOf(element) + 1;
},
set number(value) {
var stack = element.closest('stack-part'), group = Array.from(stack.qsa(element.nodeName));
if ((value=Math.max(1, number(value))) < group.length)
group[value-1].parentNode.insertBefore(element, group[value - (group.indexOf(element)>value ? 1 : 0)]);
else stack.appendChild(element);
}
};
}
ElementTemplate.Create("card-part", "marked=false,bkgndID=0", "card-or-background-template",`<style>
:host {
box-sizing: border-box;
}

:host:before { content: "-"; font-size: 1px; visibility: hidden; pointer-events: none; display: inline-block; height: 0px; width: 0px; }
/*:host:after { content: "-"; font-size: 1px; visibility: hidden; pointer-events: none; display: inline-block; height: 0px; width: 0px; }	 */
/* Safari bug workaround: the " " avoids that 4px margin below the card in Safari. But it causes a repaint on every mouseEnter and mouseLeave of card parts...
I think it's the larger outside web component that gets redrawn, sometimes the modal dialog, sometimes the card */

/* the background is above the card color. So we want to hide the background color if we have a card color. */
/* But ONLY in non-background mode. */
:host([color]) background-part { --backgrounded-card-color: var(--override-backgrounded-card-color); }

:host canvas.canvas { display: var(--background-mode-none, initial); z-index: 1; }
:host slot { visibility: var(--background-mode-hidden, visible); }
:host background-part {
position: absolute; left: 0; top: 0;
width: var(--stack-or-card-width);
height: var(--stack-or-card-height);
--background: white;
}
:host background-part button-part { outline: var(--bkgnd-button-part-outline, var(--part-outline)); pointer-events: var(--card-or-bkgnd-part-pointer-events); }
:host background-part field-part { outline: var(--bkgnd-field-part-outline, var(--part-outline)); pointer-events: var(--card-or-bkgnd-part-pointer-events); }

:host background-part field-part:not([wideMargins="false" i]):not([sharedText]) { padding: 4px 5px; }
:host background-part field-part[autoSelect]:not([autoSelect="false" i]) > div.selected { background: black; color: white; margin-left: -0.25em; margin-right: -0.25em; padding: 0 0.25em; }

:host background-part > *
{ transform: translate3d(0,0,0); } 	/* this, finally, seems to fix the ghastly transform clipping bug in Safari */

/* this one works for background flds */
:host /*background-part*/ field-part:not([fixedLineHeight]) > div:nth-of-type(1):first-line { xcolor: green; line-height: var(--first-field-line-line-height); }

:host /*background-part*/ .bold { font-weight: bold; }
:host /*background-part*/ .underline { text-decoration: underline; }
:host /*background-part*/ .italic { font-style: italic; }
:host /*background-part*/ .outline { -webkit-text-stroke: 0.5px black; text-stroke: 0.5px black; color: white; caret-color: black; font-weight: bold; }
:host /*background-part*/ .shadow { text-shadow: 1px 1px 2px gray; }
:host /*background-part*/ .outline.shadow { text-shadow: 1px 1px 0px black; letter-spacing: 1px; }
:host /*background-part*/ .condense:not(.extend) { letter-spacing: -1px; }
:host /*background-part*/ .extend:not(.condense) { letter-spacing: 1px; }
:host /*background-part*/ .group { text-decoration: underline; text-decoration-style: dotted; text-decoration-thickness: 2px;  }
:host /*background-part*/ [textAlign="left" i] { text-align: left; }
:host /*background-part*/ [textAlign="center" i] { text-align: center; }
:host /*background-part*/ [textAlign="right" i] { text-align: right; }

:host #cardcolor
{
background: var(--background, transparent);
background-size: contain;
}
:host #cardcolor[hasAddColorData=true] {
background: var(--stack-background-mode-empty-url, var(--colorData-background-for-card, url())), var(--colorData-background-for-bkgnd, url());
background-size: var(--stack-background-mode-cover, var(--colorData-background-size-for-card, cover)), var(--colorData-background-size-for-bkgnd, cover);
background-blend-mode: var(--stack-background-mode-normal, var(--colorData-background-blend-mode-for-card, normal)), var(--colorData-background-blend-mode-for-bkgnd, normal);
}
:host div.display[hasAddColorData=true] {
mix-blend-mode: multiply;
--hasAddColorData-inhibit-color: hasAddColorData-inhibit-color;
}

</style>`);

document.write('<style>' + `
body stack-part > background-part { display: none; }

` + '</style>');
function background_part(element,template)
{
return {
get background() {
return element;
// returns the cloned node if it exists
/*var bg = element.bkgndID && element.closest('stack-part').qs(`:scope > background-part[ID="${element.bkgndID}"]`);
return bg && (bg.cloned_node || bg);*/
},
get card() {
return sim.card;
},
get number() {
var me = element.clone_of || element;
return Array.from(me.closest('stack-part').qsa(me.nodeName)).indexOf(me) + 1;
},
};
}
ElementTemplate.Create("background-part", "", "card-or-background-template",`<slot></slot><style>
:host #cardcolor
{
background: var(--backgrounded-card-color, var(--background, transparent));
background-size: contain;
}
</style>`);

"use strict";
function button_or_field_template(element,template)
{
function adjustFont()
{
// hc lineheight is different! very mysterious. let's say if it's 32 then go to css lineheight 0
//element.style.lineHeight = (element.textSize && element.textSize >= 16) ? 1.2-(Math.min(8,element.textSize-16)/40) : '';
element.style.lineHeight = (element.textSize && element.textHeight)
? parseFloat(element.textHeight)/parseFloat(element.textSize)
: '';
/*element.style.lineHeight = (element.lineHeight && parseFloat(element.lineHeight) >= 16)
? 1.2-(Math.max(24,element.lineHeight)/4)
: (element.textSize && element.lineHeight)
? parseFloat(element.lineHeight)/parseFloat(element.textSize)
: '';*/
//if (element.style.lineHeight) console.log(element.style.lineHeight);
element.style.fontFamily = element.textFont;
element.style.fontSize = element.textSize+'px';
var styles = String(element.textStyle).toLowerCase().split(/[\W]+/g);
['bold','italic','underline','outline','shadow','condense','extend','group'].forEach((s)=>element.classList.toggle(s,styles.includes(s)));
}
adjustFont();

return {
get owner() {
return element.closest('card-part, background-part');
},
get number() {
return Array.from(element.owner.qsa(element.nodeName)).indexOf(element) + 1;
},
set number(value) {
var group = Array.from(element.closest('card-part, background-part').qsa(element.nodeName));
if ((value=Math.max(1, number(value))) < group.length)
group[value-1].parentNode.insertBefore(element, group[value - (group.indexOf(element)>value ? 1 : 0)]);
else element.owner.appendChild(element);
},
get partNumber() {
return Array.from(element.owner.qsa('button-part,field-part')).indexOf(element) + 1;
},
set partNumber(value) {
var group = Array.from(element.closest('card-part, background-part').qsa('button-part,field-part'));
if ((value=Math.max(1, number(value))) < group.length)
group[value-1].parentNode.insertBefore(element, group[value - (group.indexOf(element)>value ? 1 : 0)]);
else element.owner.appendChild(element);
},
get visible() {
return !element.matches('[visible="false" i]');
},
set textFont(value) { adjustFont(); },
set textSize(value) { adjustFont(); },
set textStyle(value) { adjustFont(); },
set textAlign(value) { adjustFont(); },
set textHeight(value) { adjustFont(); },
set topLeft(value) {
value = value && point(value) || '';
element.style.setProperty('--left', (value.length==2) ? value[0]+'px' : '');
element.style.setProperty('--top', (value.length==2) ? value[1]+'px' : '');
},
get location() {
if (!(element.topLeft && element.width && element.height))
return "";
var value = point(element.topLeft);
return [value[0] + Math.floor(parseInt(element.width)/2), value[1] + Math.floor(parseInt(element.height)/2)];
},
set location(value) {
value = point(value);
if (value.length == 2)
element.topLeft = [value[0] - Math.floor((parseInt(element.width)||0)/2),
value[1] - Math.floor((parseInt(element.height)||0)/2)];
},
get loc() { return element.location; }, set loc(value) { element.location = value; },
get left() {
return point(element.topLeft)[0];
},
set left(value) {
var loc = point(element.topLeft);
element.topLeft = [value,loc[1]];
},
get top() {
return point(element.topLeft)[1];
},
set top(value) {
var loc = point(element.topLeft);
element.topLeft = [loc[0],value];
},
get right() {
return point(element.topLeft)[0] + number(element.width);
},
set right(value) {
element.left = number(value) - number(element.width);
},
get bottom() {
return point(element.topLeft)[1] + number(element.height);
},
set bottom(value) {
element.top = number(value) - number(element.height);
},
set width(value) {
// note that if something changes the style.width on the obejct itself it will stick there
element.style.setProperty('--width', (value=='') ? '' : value+'px');
},
get bottomRight() {
return [number(element.left) + number(element.width), number(element.top) + number(element.height)];
},
set bottomRight(value) {
value = point(value);
element.right = value[0];
element.bottom = value[1];
},
get botRight() { return element.bottomRight; },
set botRight(v) { element.bottomRight = v; },
set height(value) {
element.style.setProperty('--height', (value=='') ? '' : value+'px');
},
get rectangle() {
var loc = element.topLeft&&point(element.topLeft) || [0,0]
return loc.concat([loc[0] + parseInt(element.width || element.offsetWidth), loc[1] + parseInt(element.height || element.offsetHeight)]);
},
set rectangle(value) {
value = rectangle(value);
element.topLeft = [value[0],value[1]];
element.width = value[2]-value[0];
element.height = value[3]-value[1];
},
get rect() { return element.rectangle; },
set rect(v) { element.rectangle = v; }
}
}
ElementTemplate.Create("button-or-field-template", "id,visible=true,topLeft,width,height,textHeight,textAlign='',textFont='',textSize='',textStyle='plain',color='',bevel=0", "xtalk-common-template",`<style>
:host {
position: relative; z-index: 1;
width: var(--width, auto);
height: var(--height, auto);
font: var(--font);
--left: 0px; --top: 0px;
}
:host([visible="false" i]) {
/* making the bg fld invisible doesn't hide the slotted div apparently. But display: none will. (--override-visibility is 'initial' so still works) */
visibility: var(--override-visibility, hidden);
display: var(--override-visibility, none);
/*opacity: 0; pointer-events: none; */
}
:host([topLeft]) { position: absolute; left: var(--left); top: var(--top); }
:host([topleft][width][height]) { contain: strict; }
</style>`);

document.write('<style>' + `
/* none of this gets seen in the background field unfortunately */
/*field-part[autoSelect]:not([autoSelect="false" i]) > div { user-select: all; -webkit-user-select: all; }*/

field-part a { color: #222; text-decoration-style: solid; text-decoration-color: gray; }
field-part a:visited { color: #66A; }
field-part a:active { color: blue; }
card-part > div[slot] { outline: none; }

/* this will work for card fields, but not background fields */
field-part:not([fixedLineHeight="true"]) > div:nth-of-type(1):first-line { line-height: 1; } 	/* might help dunno yet */
field-part[autoSelect]:not([autoSelect="false" i]) > div.selected { background: black; color: white; margin-left: -0.25em; margin-right: -0.25em; padding: 0 0.25em; }
card-part > div[slot] > div.selected { background: black; color: white; margin-left: -0.25em; margin-right: -0.25em; padding: 0 0.25em; }

` + '</style>');"use strict";

function field_part(element,template)
{
if (element.getAttribute('spellcheck')) template.qs('#inner').setAttribute('spellcheck',element.getAttribute('spellcheck'));
if (element.getAttribute('autoreplace')) template.qs('#inner').setAttribute('autoreplace',element.getAttribute('autoreplace'));

element.addEventListener('scroll',(event)=>element.scroll=element.scrollTop);

element.dirty = false;
//element.addEventListener('input', (event)=>{ /*console.log('input',element);*/ dirty = true; XTalk.Send(element, 'keyDown', [event.data]); }, true);
element.addEventListener('input', (event)=>{ /*console.log('input',element);*/ element.dirty = true; }, true);
//element.addEventListener('keydown', (event)=>{ console.log('keydown',element); element.dirty = true; XTalk.Send(element, 'keyDown', [(event.key=='Enter')?'\n':event.key]); }, true);
element.addEventListener('focus', (event)=>{ /*console.log('focis',element);*/ /*element.dirty = false;*/ XTalk.Send(element, 'openField'); }, true);
element.addEventListener('blur', (event)=>{ /*console.log('blur',element);*/
var wasDirty = element.dirty;
if (!element.leaveDirtyOnClose) element.dirty=false;
XTalk.Send(element, wasDirty ? 'closeField' : 'exitField');
}, true);

element.addEventListener('pointerdown', (event)=>{
var target = event.composedPath()[0] || event.target;
var clickDiv = target.closest('field-part > div') || target.closest('div[slot] > div');
//console.log(clickDiv);

/*if (element.matches('[autoSelect]:not([autoSelect="false" i])'))
element.contentsContainer().qsa(':scope > div').forEach
((d,i,a)=>d.classList.toggle('selected', (d===clickDiv) || (i===a.length-1 && !clickDiv && (clickDiv=d))));*/
if (element.matches('[autoSelect]:not([autoSelect="false" i])'))
element.selectedLine = Array.from(element.contentsContainer().qsa(':scope > div')).findIndex((d)=>(d===clickDiv)) + 1;

if (element.closest('card-part, background-part'))	// only for stacks
sim.clickLine = clickDiv ? 'line ' + (Array.from(clickDiv.parentNode.qsa(':scope > div')).findIndex((d)=>d===clickDiv)+1) + ' of ' + element.longName : '';
});

var bkgnd_content_slot = null, attachedTarget = null;
function detachfix()
{ if (attachedTarget) { ContentEditableFix.Detach(attachedTarget); attachedTarget = null; } }
function adjustcontenteditable() {
if (!element.isConnected) return;	// don't do this until the field is 'awake'
// there is an issue: if the field is connected, and then text streams in, an initial <div><br></div> would be placed, this is bad
detachfix();
var ceTarget = bkgnd_content_slot && bkgnd_content_slot.assignedNodes()[0], lock = (element.lockText && element.lockText != 'false');
if (ceTarget) {
ContentEditableFix.Attach(attachedTarget=ceTarget);
//ceTarget.contentEditable = !(element.lockText && element.lockText != 'false');
element.contentEditable = false;
}
else {
ContentEditableFix.Attach(attachedTarget=element);
template.qs('#inner').contentEditable = !lock;
//element.contentEditable = !(element.lockText && element.lockText != 'false');
}
(ceTarget || element).contentEditable = !lock;
}
//if (element.name=='Safari') debugger;
function setaddcolor() {
element.style.setProperty('--fld-border', (element.color || element.bevel)
? ('calc(' + Math.abs(element.bevel||0) + 'px + var(--plusbevel, 0px)) ' + ((element.bevel < 0) ? 'inset' : 'outset') + ' ' + (element.color || ''))
: '');
element.style.setProperty('--color-attribute', element.color || '');
}
setaddcolor();
//element.style.setProperty('--background', element.color);
return {
// ok I need bkgndFieldDuty to track changes to sharedText. the original sharedtext maybe belongs in the original background.
assumeBkgndFieldDuty() {	// this is permanent and seems to run before connected()
detachfix();
Array.from(element.qsa('slot')).forEach((c)=>{ if (c.nodeName=='SLOT') c.parentNode.removeChild(c); });
//console.log('assuming bg fld duty',element);
var slotname = '-'+element.id;
template.qs('div#inner').parentNode.insertBefore(template.qs('slot'),template.qs('div#inner'));
template.qs('div#inner').style.display='none';
//template.replaceChild(template.qs('div#inner slot'), template.qs('div#inner'));	// needed or we a click in empty space won't select the field
if (bkgnd_content_slot && bkgnd_content_slot.parentNode) bkgnd_content_slot.parentNode.removeChild(bkgnd_content_slot);
bkgnd_content_slot = document.createElement('slot');
bkgnd_content_slot.name = slotname;
bkgnd_content_slot.addEventListener('slotchange',(event)=>{ /*console.log('slot changed', bkgnd_content_slot.assignedNodes());*/ adjustcontenteditable(); });
// here's the trick...KEEP the inner HTML. (do we care if it's nodes here?)
element.shared_contents = new DocumentFragment();
while (element.firstChild) {
if (element.firstChild.nodeName=='SLOT') element.removeChild(element.firstChild);
else element.shared_contents.appendChild(element.firstChild);
}
element.appendChild(bkgnd_content_slot);
//console.log('assumeBkgndFieldDuty');
adjustcontenteditable();
},
relieveBkgndFieldDuty() {
detachfix();
//console.log('relieving bkgnd duty',element);
//debugger;
// background fields have a <slot name=-id></slot>, which tends to get turned into <div><slot name=-id></slot><br></div>
if (bkgnd_content_slot && bkgnd_content_slot.parentNode) bkgnd_content_slot.parentNode.removeChild(bkgnd_content_slot);
bkgnd_content_slot = null;
template.qs('div#inner').appendChild(template.qs('slot'));
template.qs('div#inner').style.display='';
element.innerHTML = '';
element.appendChild(element.shared_contents);
delete element.shared_contents;
Array.from(element.qsa('slot')).forEach((c)=>{ if (c.nodeName=='SLOT') c.parentNode.removeChild(c); });
adjustcontenteditable();
},
contentsContainer() {
return (bkgnd_content_slot && bkgnd_content_slot.assignedNodes()[0]) || element;
},
connected() {
//console.log('field connected');
adjustcontenteditable();
element.scrollTop = element.scroll||0;
},
disconnected() {
detachfix();
},
set color(value) { setaddcolor(); },
set bevel(value) { setaddcolor(); },
set scroll(value) {
element.scrollTop = value||0;
},
get contents() {
return ContentEditableFix.InnerText(element.contentsContainer());
},
set contents(value) {
// would be nice to trigger the ContentEditableFix quickly, but this will work
//console.log(element.id);
//if (element===askdialog.qs('#askdialog #result')) console.log('beep');
//element.contentsContainer().innerHTML = String(value).split('\n').map((v)=>"<div>"+ContentEditableFix.HTMLEncode(v)+"<br></div>").join('');
value = String(value);
element.contentsContainer().innerHTML = !value.trim() ? "<div><br></div>" : "<div>"+value.split('\n').map((v)=>ContentEditableFix.HTMLEncode(v)).join('<br></div><div>')+"</div>";
},
contentsProxyForCard(card) {
if (element.sharedText) return element;
return new Proxy(element, {
get(obj,prop,receiver) {
//console.log(obj,prop);
if (typeof prop === 'string' && prop.toLowerCase() === 'contents') {
var src = card.qs(':scope > div[slot="-' + element.id + '"]');
return src ? ContentEditableFix.InnerText(src) : '';
}
return Reflect.get(...arguments);
},
set(obj,prop,value) {
//console.log(obj,prop,value);
if (typeof prop === 'string' && prop.toLowerCase() === 'contents') {
var src = card.qs(':scope > div[slot="-' + element.id + '"]');
if (!src) {
card.appendChild(src=document.createElement('div'));
src.setAttribute('slot', "-" + element.id);
}
//src.innerHTML = String(value).split('\n').map((v)=>"<div>"+ContentEditableFix.HTMLEncode(v)+"<br></div>").join('');
value = String(value);
src.innerHTML = !value.trim() ? "<div><br></div>" : "<div>"+value.split('\n').map((v)=>ContentEditableFix.HTMLEncode(v)).join('<br></div><div>')+"</div>";
return true;
}
return Reflect.set(...arguments);
}
});
},
/*contentsContainerForCard(card) {
return (!element.sharedText && card.qs(':scope > div[slot="-' + element.id + '"]')) || element;
},
contentsForCard(card) {
if (element.sharedText) return element.contents;
var src = card.qs(':scope > div[slot="-' + element.id + '"]');
return src ? ContentEditableFix.InnerText(src) : '';
},*/
set lockText(value) {
adjustcontenteditable();
},
set sharedText(value) {
var st = String(value) && String(value)!='false';
if (st && bkgnd_content_slot)
element.relieveBkgndFieldDuty();
else if (!st && !bkgnd_content_slot
&& element.closest('background-part,card-part') && element.closest('background-part,card-part').matches('background-part'))
element.assumeBkgndFieldDuty();
},
get selectedDiv() {
// for autoSelect
return element.contentsContainer().qs(':scope > div.selected');
},
get selectedText() {
// for autoSelect
var text = Array.from(element.contentsContainer().qsa(':scope > div.selected')).map((d,i)=>ContentEditableFix.InnerText(d)).join('\n');
text = (text[text.length-1]=='\n') ? text.substr(0,text.length-1) : text;
return text;
},
set selectedText(value) {
value = String(value).toLowerCase();
var lines = Array.from(element.contentsContainer().qsa(':scope > div'));
var index = lines.findIndex((d)=>{
var text = ContentEditableFix.InnerText(d).toLowerCase();
text = (text[text.length-1]=='\n') ? text.substr(0,text.length-1) : text;
return (text.toLowerCase()==value);
});
lines.forEach((d,i)=>d.classList.toggle('selected', (i===index)));
},
get selectedLine() {
// for autoSelect or for regular selection
var min = 0, max = 0, sel = getSelection(), range = sel.rangeCount && sel.getRangeAt(0);
Array.from(element.contentsContainer().qsa(':scope > div')).forEach((d,i)=>{
if (!d.classList.contains('selected') && !(range && range.intersectsNode(d))) return;
min = Math.min(i+1, min || (i+1));
max = Math.max(i+1, max || (i+1));
});
return 'line ' + min + ' to ' + max + ' of ' + element.longName;
},
set selectedLine(value) {
// for autoSelect
//debugger;
if (element.matches('[autoSelect]:not([autoSelect="false" i])')) {
value=number(value);
Array.from(element.contentsContainer().qsa(':scope > div')).forEach
((d,i,a)=>d.classList.toggle('selected', (i==value-1) || (i===a.length-1 && value>a.length)));
}
else {
value = parseInt(value);
var div = element.contentsContainer().qsa(':scope > div')[value-1];
if (div) getSelection().selectAllChildren(div);
}
}
};
}
ElementTemplate.Create("field-part", "type,scroll=0,lockText=false,dontWrap=false,autoSelect=false,sharedText=false,multipleLines=false,wideMargins=true,fixedLineHeight=false,showLines=false", "button-or-field-template",`<div id="inner"><slot></slot></div><style>
:host {
display: flex; box-sizing: border-box; overflow: hidden;
-webkit-user-select: text; user-select: auto; /* text,auto? */
min-height: 1em;
word-wrap: break-word;
white-space: pre-wrap;
tab-size: 2;
-webkit-nbsp-mode: space;
line-break: after-white-space;
--background: white;
--fld-border: none;
--font: var(--stack-field-font, inherit);
position: relative;
border: var(--fld-border, 1px solid transparent);
box-sizing: border-box;
--part-outline: 1px solid transparent;
outline: var(--part-outline); outline-offset: -1px;

background: var(--special-field-tool-background-color-attribute, var(--color-attribute, var(--background, white)));
/* note: this keyframe has the same 0%,100% and the animation has one step. If the browser is wasting cycles redrawing your page that's ITS fault. */
animation: var(--hasAddColorData-inhibit-color, none) 2147483647s normal steps(1);

background-size: contain;
background-attachment: local;
background-position: var(--special-field-tool-background-position, 0px calc(3px - 0.1em));
}
@keyframes hasAddColorData-inhibit-color {
0%,100% { background: var(--special-field-tool-background, var(--background, white)); }
}

:host([showLines]:not([showLines="false" i])) {
--special-field-tool-background: repeating-linear-gradient(var(--background, transparent), var(--background, transparent) calc(1.125em - 1px), #CCC 1.125em);
--special-field-tool-background-color-attribute: repeating-linear-gradient(var(--color-attribute, var(--background, transparent)), var(--color-attribute, var(--background, transparent)) calc(1.125em - 1px), #CCC 1.125em);
}
:host([wideMargins="false" i]) {
--special-field-tool-background-position: 0px calc(0px - 0.1em);
}

:host(:not([lockText])) { cursor: text; }
:host(:not([topLeft])) { margin: 0.25em; }
:host(:not([wideMargins="false" i])) div#inner { padding: var(--field-padding, 4px); }
:host([wideMargins="false" i]) div#inner { padding: var(--field-padding, 1px 3px); }
:host([dontWrap]) { white-space: nowrap; }
:host([type="transparent" i]), :host(:not([type])) { xbackground: var(--background); --background: transparent; --fld-border: 1px solid transparent; --plusbevel: 0px; }
:host([type="opaque" i]) { xbackground: var(--background); --plusbevel: 0px; --fld-border: 1px solid transparent;
clip-path: inset(0px 0px);	/* workaround for another Safari draw bug */
}
:host([type="rectangle" i]) { xbackground: var(--background); --fld-border: 1px solid transparent; --part-outline: 1px solid black; --plusbevel: 1px; }
:host([type="shadow" i]) { xbackground: var(--background); --fld-border: 1px solid transparent; --part-outline: 1px solid black; --plusbevel: 1px;
box-shadow: 2px 2px 0px 0px black; }
:host([type="scrolling" i]) { xbackground: var(--background); --plusbevel: 1px; --fld-border: 1px solid transparent; --part-outline: 1px solid black; overflow: scroll; max-height: 100%; --background: white; overscroll-behavior: contain; }

::slotted(div[slot]) { flex: 1; }

:host div#inner { flex: 1; outline: none; --color-attribute: transparent; }
/* this seems to cover Chrome's need to have a container div for CE text. Otherwise it limits selection to a single div -- wrong behaviour. */
/* turns out it's not enough for safari though, because it won't accept clicks in the empty space without contenteditable. Oh well
/*:host(:not([lockText])) > div#inner { -webkit-user-modify: read-write; -webkit-user-select: text; }*/

</style>`);

document.write('<style>' + `
@supports (-webkit-backdrop-filter: invert(1)) or (-moz-backdrop-filter: invert(1)) or (backdrop-filter: invert(1)) {
:root {
--inversion-backdrop-filter: invert(1);
--inversion-backdrop-filter-transparent: transparent;
}
}
` + '</style>');"use strict";
function button_part(element,template)
{
var inner = template.qs('#inner'),
input = template.qs('input'),
caption = template.qs('#caption'),
icon = template.qs('#icon'),
select = template.qs('select');

input.id = Math.random();

inner.addEventListener('click', (event)=>{
if (['radiobutton','checkbox'].includes(element.type.toLowerCase())) {
element.hilite=input.checked;
if (event.composedPath()[0] !== input) event.stopPropagation();	// stop double sends.
}
}, true);
select.onchange = (event)=>{ (element.selectedLine=select.selectedIndex+1); XTalk.Send(element, 'mouseUp'); };

element.addEventListener('mousedown', (event)=>{
// autohilite is based on :active:hover, but we have to prevent text selection drags out of the button (but only in safari)
if (navigator.vendor=='Apple Computer, Inc.' && (event.composedPath()[0].nodeName||'').toLowerCase()!='select')
event.preventDefault();
});

element.addEventListener('click',(event)=>{ 		// should this be in mouseup or what
if (element.autoHilite && element.family && element.enabled != 'false' && element.type.toLowerCase()!='checkbox' && element.type.toLowerCase()!='radiobutton')
element.hilite = true;
}, true);

function fillselect() {
if (document.readyState == 'loading') return;
var splits = ContentEditableFix.InnerText(element).split('\n');
if (!splits[splits.length-1].trim()) splits.pop();
select.innerHTML = splits.map((l)=>"<option>"+l+"</option>").join('');
select.selectedIndex = parseInt(element.selectedLine)-1;
}

function setaddcolor() {
inner.style.setProperty('--border', (element.bevel || element.color)
? (Math.abs(element.bevel||0) + 'px ' + ((element.bevel < 0) ? 'inset' : 'outset') + ' ' + (element.color || ''))
: '');
inner.style.setProperty('--styledborder', (element.bevel || element.color)
? (Math.abs(element.bevel||0) + 'px ' + ((element.bevel < 0) ? 'inset' : 'outset') + ' ' + (element.color || ''))
: '');
inner.style.setProperty('--color-attribute', element.color || '');
}
setaddcolor();

function seticon(value, onlyForLocalICON)
{
if (value=='0')
{ template.qs('#icon img').src = ''; return; }
if (!value)
{ element.icon = 0; return; }
if ( (/^(https|http|file)[\:][\/][\/]/).test(value))
{ template.qs('#icon img').src = value; template.qs('#icon img').dataset.fullsize = 'true'; return; }

var data64 = '', isInt, stack;
if (typeof sim != 'undefined' && (stack=sim.stackOf(element,!onlyForLocalICON)))
{
// this will pull icons from the current stack instead, for dialog boxes
data64 = stack.localICONs[Object.keys(stack.localICONs).find((k)=>k.toLowerCase()==String(value).toLowerCase())];
if (typeof data64 === 'number')
{ element.icon = data64; return; }
else if (data64)
{ template.qs('#icon img').src = data64; return; }
/*else if (value==32069)
debugger;*/
}
else if (onlyForLocalICON)
return;

//if (value==32069) debugger;
if (!stack) {
//console.log('icon timeout ' + value);	// second chance for localICONs load
setTimeout(()=>{
//if (value==32069) debugger;
if (typeof sim != 'undefined' && sim.stackOf(element, false)) seticon(element.icon, true);	// this one's needed when it's a localICON! Gotta fix
else setnow();
}, 0);
}
else
setnow();

function setnow()
{
if (isNaN(value) || !Number.isInteger(Number(value)))
template.qs('#icon img').src = value+(/[.][A-Za-z0-9]+$/.test(value)?'':'.png');
else
template.qs('#icon img').src = 'png-icons/icon_'+value+'.png';
//console.log(template.qs('#icon img').src);
template.qs('#icon img').dataset.fullsize = 'false';
}
}
seticon(element.icon);
//if (element.icon) console.log('set ' + element.icon + ' src=' + template.qs('#icon img').src);

return {
set type(value) {
input.type = (value.toLowerCase()=='radiobutton' ? 'radio' : 'checkbox');
//input.id = ['radiobutton','checkbox'].includes(value.toLowerCase()) ? 'input' : '';
template.qs('label').setAttribute('for', ['radiobutton','checkbox'].includes(value.toLowerCase()) ? input.id : '#');
},
set name(value) { caption.dataset.name = element.name; },
set color(value) { setaddcolor(); },
set bevel(value) { setaddcolor(); },
set icon(value) {
//if (value==32069) debugger;
seticon(value);
},
set enabled(value) { input.disabled = select.disabled = !boolean(value); },
get hilite()
{ return element.matches(`[hilite]:not([hilite="false" i]), :not([autoHilite="false" i]):hover:active`); },
set hilite(value) {
input.checked = (value=boolean(value));
var layer = element.closest('card-part,background-part');
if (element.id && !element.sharedHilite && layer && layer.matches('background-part')) {
var card = layer.getRootNode().host, dataObj = card && card.qs('div[slot="-' + element.id + '"]');
if (card && card.matches('card-part') && !value && dataObj)
dataObj.parentNode.removeChild(dataObj);
else if (card && card.matches('card-part') && value && !dataObj) {
dataObj = document.createElement('div');
dataObj.slot = '-' + element.id;
dataObj.innerText = '1';
card.appendChild(dataObj);
}
}
if (!element.setting_family_hilite /*&& element.autoHilite*/ && element.family) {
var ec = element.closest('card-part, background-part, stack-part, modal-dialog') || body;
ec.qsa('button-part[family]').forEach((e)=>{
if (e !== element && e.family == element.family && e.hilite && (e.closest('card-part, background-part, stack-part, modal-dialog')||body) === ec) {
e.setting_family_hilite = true;
e.hilite = false;
delete e.setting_family_hilite;
}
});
}
},
get highlite() { return element.hilite; }, get hilight() { return element.hilite; }, get highlight() { return element.hilite; },
set highlite(v) { element.hilite = v; }, set hilight(v) { element.hilite = v; }, set highlight(v) { element.hilite = v; },
get sharedHilite()
{ return element.matches(`:not([sharedHilite="false" i])`); },
connected() {
if (element.type.toLowerCase()=='popup') {
if (document.readyState != 'loading') fillselect();
else document.addEventListener('DOMContentLoaded', dcl, true);
function dcl(event)
{ document.removeEventListener('DOMContentLoaded',dcl); fillselect(); }
}
},
disconnected() { //resizeObserver.unobserve(caption);
},
get contents() {
var it = ContentEditableFix.InnerText(element);
if (element.has_false_innerHTML && it==' ') it = '';
return it.substring(0,(it[it.length-1]=='\n') ? it.length-1 : it.length);
},
set contents(value) {
value = String(value);
element.innerText = (element.has_false_innerHTML=!value) ? ' ' : value; /* needed for in-text sel */
fillselect();
},
get selectedLine() {
if (element.owner)
return 'line ' + (select.selectedIndex+1) + ' of ' + element.longNumber;
else
return select.selectedIndex + 1;
},
set selectedLine(value) { select.selectedIndex = parseInt(value)-1; },
get selectedText() { return select.value; },
set selectedText(value) {
select.value = value;	// try exactly...but if that doesn't work....
var index = select.selectedIndex;
if (index==-1) index = Array.from(select.qsa('option')).findIndex( (o)=>((o.value||'').toLowerCase().replaceAll(/[\s]/g,'')==value.toLowerCase().replaceAll(/[\s]/g,'')) );
element.selectedLine = index+1;
}

};
}
ElementTemplate.Create("button-part", "type=transparent,hilite|highlight|highlite|hilight=false,autoHilite=true,sharedHilite=true,family='',showName=true,enabled=true,icon=0,selectedLine=0", "button-or-field-template",`<section id="section"><slot></slot></section><label id="inner" for="#"><input type="checkbox"><div id="icon"><img draggable="false"></div><div id="caption"></div><select></select></label><style>
:host {
position: relative; display: inline-block; overflow: hidden; box-sizing: border-box;
vertical-align: middle;
--default-font: bold 1em system-ui;
--font: var(--stack-button-font, var(--default-font));
--width: auto; --height: auto; --inner-inset: 0px;
-webkit-user-select: none; user-select: none; -webkit-user-modify: none; user-modify: none;
--part-outline: 1px solid transparent;
outline: var(--part-outline); outline-offset: -1px;
/*outline: none; outline-offset: -1px;*/
}
:host * { pointer-events: var(--context-menu-none); }	/* make shadow invisible to context events */
:host([textFont]:not([textFont=""])) { --default-font: inherit; }

:host #section {
/* this needs to be here for innerText to work...*/
display: inline; opacity:0; position:absolute; width: 0px; height: 0px; overflow: hidden; pointer-events: none;
}

/* need to go down the list and make variables for everything */
:host { --background: white; --color: black; --border: black; }
:host(:not([type])), :host([type="transparent" i]), :host([type="oval" i]), :host([type=checkbox i]), :host([type=radiobutton i]), :host([type=popup i]) {
--background: --transparent;
--icon-caption-background: white;
}

/* transparent disabled buttons gray out the background */
:host([enabled="false" i]:not([type])), :host([enabled="false" i][type="transparent" i]) {
-webkit-backdrop-filter: invert(100%) brightness(33%) invert(100%);
backdrop-filter: invert(100%) brightness(33%) invert(100%);
}

:host([enabled="false" i]) { --border: gray; x-webkit-filter: invert(100%) brightness(70%) invert(100%); }
:host([enabled="false" i]) #inner *:not(input) { opacity: 0.5; }

:host(:not([autoHilite="false" i]):not([enabled="false" i]):hover:active),
:host([hilite]:not([hilite="false" i])) {
--active-background: black; --active-color: var(--background); --active-img-filter: invert(100%); --active-value-none: none; --icon-caption-background: inherit;
}
:host(:not([autoHilite="false" i]):not([enabled="false" i]):not([type="checkbox" i]):not([type="radiobutton" i]):hover:active),
:host([hilite]:not([hilite="false" i]):not([type="checkbox" i]):not([type="radiobutton" i])) {
--hasAddColorData-inhibit-color: none;	/* just during the hilite should be fine */
}

:host(:not([type]):not([autoHilite="false" i]):not([enabled="false" i]):active:hover),
:host(:not([type])[hilite]:not([hilite="false" i])),
:host([type="transparent" i]:not([autoHilite="false" i]):not([enabled="false" i]):active:hover),
:host([type="transparent" i][hilite]:not([hilite="false" i])),
:host([type="oval" i]:not([autoHilite="false" i]):not([enabled="false" i]):active:hover), :host([type="oval" i][hilite]:not([hilite="false" i])) {
--special-background-filter: var(--inversion-backdrop-filter-transparent);	/* if supported */
-webkit-backdrop-filter: var(--inversion-backdrop-filter);
-moz-backdrop-filter: var(--inversion-backdrop-filter);
backdrop-filter: var(--inversion-backdrop-filter);
--active-color: white;
}
:host([type="popup" i]:not([autoHilite="false" i]):not([enabled="false" i]):active:hover), :host([type="popup" i][hilite]:not([hilite="false" i]))
{ --active-color: white; }

@keyframes hasAddColorData-inhibit-color {
/* Safari problem: when --active-background changes, the animation doesn't notice. I think we can fix this temporarily by zeroing out the animation during hilite */
/* we're doing all this, by the way, so that the card can set a CSS variable that will inhibit --color-attribute. Isn't there a better way?? */
0%,100% { background: var(--special-background-filter, var(--active-background, var(--background))); }
}

:host(:not([type])) #inner, :host([type="transparent" i]) #inner, :host([type="opaque" i]) #inner, :host([type="rectangle" i]) #inner, :host([type="roundrect" i]) #inner, :host([type="shadow" i]) #inner, :host([type="standard" i]) #inner, :host([type="default" i]) #inner, :host([type="oval" i]) #inner, :host([type="popup" i]) #icon
{
background: var(--special-background-filter, var(--active-background, var(--color-attribute, var(--background))));
/* note: this keyframe has the same 0%,100% and the animation has one step. If the browser is wasting cycles redrawing your page that's ITS fault. */
animation: var(--hasAddColorData-inhibit-color, none) 2147483647s normal steps(1);

color: var(--active-color, var(--color));
border: var(--border);
}
:host([type="popup" i]) #inner
{
background: var(--color-attribute, var(--background));
animation: var(--hasAddColorData-inhibit-color, none) 2147483647s normal steps(1);

color: var(--color);
border: var(--border);
}
:host([type="popup" i]) #caption
{
background: var(--active-background, var(--color-attribute, none));
animation: var(--hasAddColorData-inhibit-color, none) 2147483647s normal steps(1);

color: var(--active-color, var(--color));
}
:host([type="checkbox" i]) #inner, :host([type="radiobutton" i]) #inner {
background: var(--color-attribute, var(--background));
--active-background: transparent;
animation: var(--hasAddColorData-inhibit-color, none) 2147483647s normal steps(1);
--override-img-filter: none;
}

:host input { margin-right: 0.25em; }
:host(:not([type="checkbox" i]):not([type="radiobutton" i])) input { display: none; }
:host(:not([type="popup" i])) select { display: none; }

:host(:not([type])), :host([type="transparent" i]) { }
:host([type="opaque" i]) { border: 1px solid var(--special-background-filter, var(--active-background, var(--background))); }
:host([type="rectangle" i]) { border: thin solid var(--border); }
:host([type="roundrect" i]) { border: thin solid var(--border); border-radius: 10px; box-shadow: 1px 1px 0px var(--border); }
:host([type="shadow" i]) { border: thin solid var(--border); box-shadow: 1px 1px 0px var(--border); }
/* there is a Safari bug that misclips the roundrect on the right leaving a white spot; this (3/16)px and absolutely no less inset boxshadow untriggers the bug */
:host([type="standard" i]) { border: thin solid var(--border); border-radius: 8px; box-shadow: inset 0px 0px 0px 0.1875px black; }
:host([type="default" i]) { border: 3px solid var(--border); border-radius: 10px; padding: 1px; }
:host([type="default" i]) #inner { border: var(--styledborder, thin solid var(--border)); border-radius: 6px; xpadding: 0.25em; }
:host([type="oval" i]) { border-radius: 47.5%; }

:host([type="default" i]) #inner, :host([type="standard" i]) #inner, :host([type="roundrect" i]) #inner { --inner-inset: 1px; }

:host #inner { flex: 1; box-sizing: border-box; display: flex; place-items: center; justify-content: space-around; align-items: center; position: relative; cursor: inherit; overflow: hidden; }
:host(:not([height]):not([type="Default" i])) #inner { height: 100%; }
:host(:not([width]):not([type="Default" i])) #inner { xwidth: 100%; }

:host(:not([width]):not([type="checkbox" i]):not([type="radiobutton" i])) #inner { white-space: pre; padding: 4px; }
:host([width]:not([type="radiobutton" i]):not([type="checkbox" i]):not([type="popup" i])) #inner { flex-wrap: wrap; }
x:host([topLeft]) #inner { position: absolute; left: var(--inner-inset); top: var(--inner-inset); right: var(--inner-inset); bottom: var(--inner-inset); overflow: hidden; }
:host([width]) #inner { position: absolute; left: var(--inner-inset); right: var(--inner-inset); }
:host([height]) #inner { position: absolute; top: var(--inner-inset); bottom: var(--inner-inset); }

:host([type="roundrect" i]) #inner { xmargin: -1px; border-radius: 9px; }
:host([type="standard" i]) #inner { xmargin: -1px; border-radius: 7px; }
:host([width][type="roundrect" i]) #inner, :host([width][type="standard" i]) #inner { margin: -1px; }

:host([type="oval" i]) #inner { border-radius: 47.5%; }

:host([type="default" i]) #inner { xborder-radius: 10px; }
x:host([type="default" i]/*[bevel]:not([bevel=""]):not([bevel="0"])*/) #inner { margin: 1px; box-shadow: 0px 0px 0px 1px black; }
:host([type="default" i][color]) #inner { margin: 1px; box-shadow: 0px 0px 0px 1px black; }

:host #icon { box-sizing: border-box; --wrap-allowance: 0px; height: calc(auto - var(--wrap-allowance)); max-height: 100%; padding: 0 calc(var(--wrap-allowance) / 2) 0 calc(var(--wrap-allowance) / 2); display: flex; place-items: center; xoutline: thin solid red; pointer-events: none; }
:host/*([showName])*/ #icon { xwidth: 100%; }
:host([width]) #icon { --wrap-allowance: var(--caption-height, 0px); }
:host(:not([icon])) #icon { display: none; }
:host([type="radiobutton" i]) #icon { display: none; }
:host([type="checkbox" i]) #icon { display: none; }
:host([type="popup" i]) #icon { display: none; }
:host #icon img { xdisplay: block; height: auto; width: auto; max-height: 32px; max-width: 32px; xobject-fit: cover; min-height: 16px; filter: var(--override-img-filter, var(--active-img-filter)); xbackground: red; flex-grow: 1; object-fit: scale-down; xoutline: thin dotted red;
image-rendering: pixelated;
image-rendering: -moz-crisp-edges;
image-rendering: crisp-edges;
}
:host([icon][showname="false" i]) #icon  { xwidth: 100%; xoutline: thin dotted red }
:host(:not([topLeft])) #icon img { max-height: 1.5em; }
:host #icon img[data-fullsize="true"] { max-height: 100%; max-width: 100%; }

:host #caption { flex-grow: 1; text-align: center; xpadding: 0.25em 0 0.25em 0; xwidth: 100%; }
:host(:not([type="radiobutton" i]):not([type="checkbox" i]):not([type="popup" i])) #caption { width: 100%; }
:host([icon]:not([showname="false" i]):not([type="radiobutton" i]):not([type="checkbox" i]):not([type="popup" i])) #caption { --caption-wrapped-font: 18px GenevaNine; }
:host([type="radioButton" i]) #caption, :host([type="checkBox" i]) #caption { text-align: left; }

:host([showname="false" i]:not([type="radiobutton" i]):not([type="checkbox" i]):not([type="popup" i])) #caption  { display: none; }
:host(:not([icon])) #caption:after { content: "\\A0\\A0"; }
:host([name]:not([showname="false" i])) #caption:after { content: attr(data-name); xmargin: -3px; padding: 1px 3px;
font: var(--caption-wrapped-font, inherit); line-height: 0.8em; xletter-spacing: -0.45px; }
:host([topLeft][name]:not([showname="false" i])) #caption:after { margin: -3px; }
:host([icon][name]:not([showname="false" i])) #caption:after {
background: var(--active-background, var(--icon-caption-background, var(--background)));
}
:host([name]:not([showname="false" i]):not([topLeft])) #caption:after { padding: 0 0.25em; white-space: pre; }

:host([type="popup" i]) #caption { padding: 0.25em;}
:host([type="popup" i]) select {
cursor: inherit;
outline: none;
border: 1px solid black;
border-radius: 0;
box-shadow: 1px 1px 0px black;
-moz-appearance: none;
-webkit-appearance: none;
appearance: none;
padding: 0px 2em 0px 1em; /*padding: 5px 2em 2px 7px;*/
/*margin: -1px 0px 0px 0px;*/
font: inherit;
color: var(--color);
background: white;
background-image: url("data:image/svg+xml;charset=US-ASCII,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='10'><path fill='black' d='M0,2 l12,0 l-6,8 l-6,-8'/></svg>");
background-repeat: no-repeat;
background-position: right .7em top 50%;
background-size: 10px auto;
}
</style>`);


function title_bar_menu(element,template)
{
var to, div = template.qs('div'), span = template.qs('span');

span.onpointerdown = ()=>{ template.qs('div').style.display = ''; element.show = !boolean(element.show); }
span.onmouseleave = ()=>{ clearTimeout(to); element.show = false; }
div.onmoveleave = ()=>{ div.style.display = ''; }
div.onpointerdown = (event)=>{
element.show = false;
clearTimeout(to); to = setTimeout(()=>div.style.display = 'none', 250);
event.preventDefault();
var menuItem = event.target.closest('title-bar-menuitem');
if (menuItem)
menuItem.dispatchEvent(new CustomEvent('title-bar-domenu', { bubbles: true, composed: true, detail: menuItem }));
};

return {
set name(value) {
span.innerText = value + ' ▼';
},

set longName(value) { element.name = value; },
get longName() { return element.name },

set contents(value) {
// seems like you can use commas or returns in HC
element.innerHTML = String(value).split(/[,\n]/).map((i)=>"<title-bar-menuitem>"+ContentEditableFix.HTMLEncode(i)+"</title-bar-menuitem>").join('');
},
get contents()
{ return Array.from(element.qsa('title-bar-menuitem')).map((tbmi)=>tbmi.contents).join('\n'); },

set menuMessages(value) {
var mm = String(value).split(/[,\n]/);
Array.from(element.qsa('title-bar-menuitem')).forEach((tbmi,i)=>tbmi.menuMessage = mm[i] || '');
},
get menuMessages() {
Array.from(element.qsa('title-bar-menuitem')).map((tbmi)=>tbmi.menuMessage || '').join('\n');
}
};
}
ElementTemplate.Create("title-bar-menu", "name,show=false", "",`
<div><slot></slot></div>
<span style="">Menu ▼</span>
<style>
:host { display: inline-block; position: relative; user-select: none; -webkit-user-select: none;
font: 12px Chicago; text-align: left; position: relative; box-sizing: border-box; xoutline: thin dotted red;
border: thin solid black; border-radius: 2px; box-shadow: 1px 1px 1px gray; }
:host > span { display: inline-block; xoutline: thin dotted green; padding: 1px 4px; }
:host > div { display: none; position:absolute; top: calc(100% - 1px); background: white; border: 1px solid black; box-shadow: 0px 0px 3px gray; white-space: nowrap; z-index: 1; transform: translate3d(0,0,0); }
:host > div > div { padding: 4px 1em; }
:host([show="true" i]) > span, :host > div > div:hover { background: black; color: white; }
:host([show="true" i]) > div, :host > div:hover { display: initial; }
</style>
`);


function title_bar_menuitem(element,template)
{
return {
set contents(value)
{ element.innerText = String(value).split('\n')[0]; },
get contents()
{ return element.innerText; },
set name(value)
{ element.contents = value; },
get name()
{ return element.innerText; },
set longName(value)
{ element.name = value; },
get longName()
{ return element.name },
set markChar(value)
{ template.qs('#markChar').innerText = String(value)[0] || ' '; },
get markChar()
{ return template.qs('#markChar').innerText.trim(); },
set checkMark(value)
{ template.qs('#markChar').innerText = boolean(value) ? '√' : ' '; },
get checkMark()
{ return template.qs('#markChar').innerText=='√'; }
/*set menuMsg(value)
{ element.menuMessage = value; },
get menuMsg()
{ return element.menuMessage; }*/
};
}
ElementTemplate.Create("title-bar-menuitem", "contents,markChar,menuMessage|menuMsg", "",`
<span id="markChar" style="min-width: 1em;">&nbsp;</span>
<slot></slot>
<style>
:host { padding: 4px 1em 4px 0.5em; display: block; }
:host(:hover) { background: black; color: white; }
</style>
`);

document.write('<style>' + `
.flex-row { display: flex; flex-direction: row; align-items: baseline; }
.flex-column { display: flex; flex-direction: column; }
.flex-expand { flex: 1; flex-basis: auto; }
` + '</style>');"use strict";
var oldscroll;
var modal_dialogs_that_are_visible = [];	// only :not(.static)

window.addEventListener('keydown', (event)=>{
if (!window.has_own_offer_modal_dialog_keydown_event)
offer_modal_dialog_keydown_event(event);
}, true);
function offer_modal_dialog_keydown_event(event)
{
if (event.key=='Enter' || event.key=='Escape')
{
var lou = event.target.closest('modal-dialog.loading.offer-update');
if (lou) {
var btn = lou.shadowRoot.qs((event.key=='Enter') ? '.answer .reload' : '.answer .cancel');
btn.hilite = true; setTimeout(()=>{ btn.hilite = false; btn.click(); }, 100);
event.stopPropagation(); event.preventDefault(); return false;
}

var btn, sel = (event.key=='Enter')
? 'button-part[type="default" i]'
: 'button-part[name="Cancel" i], input[value="Cancel" i]';
var d = Array.from(modal_dialogs_that_are_visible).reverse().find((d)=>d.matches('modal-dialog[visible]:not([visible=false])'));

if (d && (btn=d.qs(sel))) {
//console.log(btn);
if ((!btn.classList.contains('ignore-keys') && !document.activeElement.closest('.ignore-keys')) || event.metaKey) {
btn.hilite = true; setTimeout(()=>{ btn.hilite = false; btn.click(); }, 100);
event.stopPropagation(); event.preventDefault(); return false;
}
}

if (event.key=='Escape' && !sim.stack.selectedPart && floatmenu.classList.contains('leaveopen')) {
floatmenu.classList.toggle('leaveclosed', !floatmenu.classList.toggle('leaveopen')); event.preventDefault(); event.stopPropagation();
return false; }
}
}
function modalresizer(md)
{
var windowInnerHeight = (window.windowheight || window).offsetHeight; // window.innerHeight;

var size = [window.innerWidth, windowInnerHeight], fullscreen = body.classList.contains('fullscreen');

mutableStyle('--overlay-height', window.visualViewport.height + 'px');

/*if (!body.qs('modal-dialog[visible=true]:not(.static)'))
{
}
else*/ if (fullscreen) {
mutableStyle('--overlay-height', null);
mutableStyle('--overlay-translate-y', null);
}
else if (window.visualViewport /*&& modal_dialogs_that_are_visible.length*/) {
if (oldscroll)
{ document.scrollingElement.scrollTop = oldscroll.value; oldscroll = null; }

mutableStyle('--overlay-top', (document.scrollingElement.scrollTop-visualViewport.top) + 'px');
mutableStyle('--overlay-bottom-size', windowInnerHeight-window.visualViewport.height + 'px');

size = [window.visualViewport.width*visualViewport.scale,window.visualViewport.height*visualViewport.scale/*-(fullscreen?0:20)*/];	// height -20 needed for ipad but not for phone...grr
//console.log(size);
/*mutableStyle('--overlay-height', size[1] + 'px');
mutableStyle('--overlay-translate-y', size[1] - (fullscreen ? 0 : window.innerHeight) + 'px');*/
}

if (modal_dialogs_that_are_visible.length)
(md ? [md] : Array.from(body.qsa('modal-dialog'))).filter((md)=>md.matches(":not(.static)")).forEach((md)=>{
var xshrink = Math.min(1, size[0]/(md.shadowRoot.qs('#dialog').offsetWidth+6));
var yshrink = Math.min(1, size[1]/(md.shadowRoot.qs('#dialog').offsetHeight+6));
var s = fullscreen ? 1 : Math.min(/*(xshrink < 0.5) ? 1 :*/ xshrink, (yshrink < 0.7) ? 1 : yshrink);
md.style.setProperty('--scale', (s!=1) ? s : '');
//md.shadowRoot.qs('#dialog').style.transformOrigin = 'top center';
md.style.setProperty('--transform', (s!=1) ? 'scale('+s+')' : '');
});

if (window.stackcontainer)
{
window.stackcontainer.scrollTop = 0;
size = [stackcontainer.offsetWidth -(fullscreen?2:6),

(windowInnerHeight*visualViewport.scale - stackcontainertd.offsetTop) /*+window.scrollY*/
/*
Math.round(window.innerHeight*visualViewport.scale)
- (fullscreen ? 0 : stackcontainer.offsetTop) */
- 3
/*+ window.scrollY*/	// this is to compensate for window.innerHeight shrinking when the ipad keyboard shows
/*- (fullscreen ? copyright.offsetHeight+10 : 0)*/];
//console.log(size);
var stackzoom = 1;
Array.from(stackcontainer.qsa('modal-dialog')).forEach((md)=>{
//md.classList.toggle('static', !fullscreen);
// we need a centering thing for full screen
var xgrow = size[0]/(md.shadowRoot.qs('#dialog').offsetWidth+1);
var ygrow = size[1]/(md.shadowRoot.qs('#dialog').offsetHeight+3);
var s = Math.min(xgrow , ygrow); //console.log(s);

// if we're gonna fill the screen i think the screen needs the same s for everything. but oh well
/*if (s > 1 && !body.classList.contains('fullscreen') && matchMedia('(pointer:fine)').matches)
s = 1;*/
if (s > 1 && matchMedia('(pointer:fine)').matches && !fullscreen)
s = 1;
else if (s > 1 && !fullscreen)
s = Math.floor(s*4)/4;

//	if (s > 1 && (!fullscreen || md.classList.contains('inactive')))
//		s=1;//s = Math.min(Math.floor(Math.sqrt(s)*8)/8, 1.5);

md.style.setProperty('--scale', (s!=1) ? s : '');
md.style.setProperty('--transform',
((!fullscreen ? '' : 'translate(' + Math.floor((size[0]-md.shadowRoot.qs('#dialog').offsetWidth*s)/2) +'px, 0px)'))
+ ((s!=1) ? ' scale('+s+') ' : ''));
stackzoom = Math.min(2,s);
});

/*if (typeof answerdialog != 'undefined' && stackzoom>1)
answerdialog.style.setProperty('--transform', (stackzoom>1) ? 'scale('+stackzoom+')' : '');
if (typeof askdialog != 'undefined' && stackzoom>1)
askdialog.style.setProperty('--transform', (stackzoom>1) ? 'scale('+stackzoom+')' : '');*/
/*if (window.answerdialog && stackzoom>1)
answerdialog.style.setProperty('--transform', (stackzoom>1) ? 'scale('+stackzoom+')' : '');
if (window.askdialog && stackzoom>1)
askdialog.style.setProperty('--transform', (stackzoom>1) ? 'scale('+stackzoom+')' : '');*/

if (window.stackcontainer_windowmoved)
stackcontainer_windowmoved();
}
}
window.addEventListener('resize', (event)=>modalresizer());
window.addEventListener('scroll', (event)=>modalresizer());
window.addEventListener('orientationchange', (event)=>modalresizer());
if (window.visualViewport) window.visualViewport.addEventListener('resize', (event)=>modalresizer(), {passive:true});
if (window.visualViewport) window.visualViewport.addEventListener('scroll', (event)=>modalresizer(), {passive:true});

var ever_waited_on_coarse = false;
function modal_dialog(element,template)
{
var titlebar = template.qs('#titlebar'), dialog = template.qs('#dialog');

new ResizeObserver(entries => requestAnimationFrame(() => { modalresizer(element); })).observe(dialog);

template.qs('#closebox').addEventListener('click', (event)=>{
element.dispatchEvent(new Event('closebox', { bubbles: true }));
event.preventDefault(); return event.stopPropagation();
});
template.qs('#zoombox').addEventListener('click', (event)=>{
element.dispatchEvent(new Event('zoombox', { bubbles: true }));
event.preventDefault(); return event.stopPropagation();
});
element.addEventListener('pointerdown', (event)=>{
if (event.composedPath()[0]===element)
{ event.preventDefault(); event.stopPropagation(); /*perform_system_beep();*/ return; }	// don't mess with the selection
});
titlebar.addEventListener('pointerdown', (event)=>{
if (!titlebar.contains(event.composedPath()[0]) || event.composedPath()[0].matches('#zoombox,#closebox')/*===template.qs('#closebox')*/) return;
if (element.matches('body.fullscreen #stackcontainer modal-dialog, modal-dialog.nodrag'))
{ event.preventDefault(); event.stopPropagation(); return; }
if (element.matches('#stackcontainer > modal-dialog') && !body.classList.contains('command')) top_stackList(element);
// when .ybottom, style.bottom moves, not top, so we get the offset from the bottom
var clickloc = [event.clientX - element.x,
element.classList.contains('ybottom') ? (element.y - (element.parentNode.getBoundingClientRect().bottom - event.clientY)) : (event.clientY - element.y)]; //console.log(clickloc);
follow_mouse(event, move,
(event,start)=>{
element.classList.toggle('dragging', start);
if (!start) element.dispatchEvent(new Event('windowmoved', { bubbles: true })); else return true; } );
function move(event)
{
requestAnimationFrame(()=>{
// reealllly needs to be 'dont escape container'
element.x = Math.max(event.clientX - clickloc[0], element.classList.contains('positivexy')?0:-999999);
// if we know the offset from the bottom, and it is as far from the parent as
element.y = element.classList.contains('ybottom')
? (element.parentNode.getBoundingClientRect().bottom - event.clientY + clickloc[1])
: Math.max((event.clientY - clickloc[1]), element.classList.contains('positivexy')?0:-999999);
element.dispatchEvent(new Event('windowmoved', { bubbles: true }));
});
}
event.preventDefault(); event.stopPropagation();
},true);

element.tabIndex = 0;
return {
set name(value) { template.qs('#titlebar span').dataset.name = value; },
set x(value) { template.qs('#dialog').style.setProperty('--x',value+'px'); },
set y(value) { template.qs('#dialog').style.setProperty('--y',value+'px'); },
get x() { return parseInt(element.getAttribute('x')) || 0; },
get y() { return parseInt(element.getAttribute('y')) || 0; },
set visible(value) {
oldscroll = { value: document.scrollingElement.scrollTop };
if (matchMedia('(pointer:coarse)').matches	// let keyboard come up before placement, on touchscreens
&& (element.contains(document.activeElement) && element!==document.activeElement)
&& !element.classList.contains('static') /*&& !ever_waited_on_coarse*/ && visualViewport.height == window.innerHeight)
{
element.style.opacity = '0';
setTimeout(()=>{ element.style.opacity = ''; }, 600);
ever_waited_on_coarse = true;
//console.log(document.activeElement, element.contains(document.activeElement));
}
else
setTimeout(()=>{modalresizer(element);},1);

if (boolean(value) && !element.classList.contains('static')) {
if (!modal_dialogs_that_are_visible.includes(element))
modal_dialogs_that_are_visible.push(element);
if (!matchMedia('(pointer:coarse)').matches)
element.focus();
}
else {
modal_dialogs_that_are_visible = modal_dialogs_that_are_visible.filter((m)=>(m!==element));
if (element.contains(ContentEditableFix.ActiveElement()))
ContentEditableFix.ActiveElement().blur();
}
},
get visible() {
return !!(element.getAttribute('visible') && element.getAttribute('visible') !='false');
},
cardWindowDelegate() {
if (!element.card_window_delegate) {
element.card_window_delegate = document.createElement('card-window-delegate');
element.card_window_delegate.connectToDialog(element);
}
return element.card_window_delegate;
},
get menubar()
{ return template.qs('#menubar'); },
getMenu(name,createIfMissing,complainIfExisting) {
var tbm = element.menubar.qs('title-bar-menu[name="'+name+'" i]');
if (!tbm && createIfMissing) {
tbm = document.createElement('title-bar-menu');
tbm.name=name;
element.menubar.appendChild(tbm);
}
else if (tbm && complainIfExisting) {
console.log("Menu " + name + " already exists");
}
return tbm;
},
deleteMenu(name, complainIfMissing) {
var tbm = element.menubar.qs('title-bar-menu[name="'+name+'" i]');
if (tbm)
element.menubar.removeChild(tbm);
else if (complainIfMissing)
console.log("Can't find menu " + name);
}
};
}
ElementTemplate.Create("modal-dialog", "name,visible,x,y", "",`<div id="dialog"><div id="titlebar"><div class="boxmargin left" style="flex: 0 1 2em;"><div id="closebox"></div></div><div style="background-position: top right;"></div><span id="title" style="position: relative;"></span><span id="flashmessage" style="color: green;"></span><span id="menubar" style="margin-top: -2px;"></span><div> </div><div class="boxmargin right" style="flex: 0 1 2em; "><div id="zoombox"></div></div></div><div id="content"><span id="cover" onpointerdown="if (typeof sim != 'undefined') sim.mouse='down';" onpointerup="if (typeof sim != 'undefined') sim.mouse='up';"><div class="answer"><button-part type="standard" visible="false" name="Extrabutton" onclick=""></button-part><button-part class="reload" type="default" name="Reload ↺" onclick="this.getRootNode().host.performUpdateReload(); this.getRootNode().host.classList.remove('loading','offer-update');"></button-part> <button-part type="standard" class="cancel" name="Cancel" onclick="this.getRootNode().host.classList.remove('loading','offer-update');"></button-part> </div></span><slot></slot><!--div style="clear:both;"></div!--></div></div><style>

:host #flashmessage { width: fit-content; font: caption; padding-right: 4px; xtransition: opacity 0.15s; }
:host #flashmessage:empty { xwidth: 0px; xpadding: 0px; opacity: 0; display: none; }

:host {
cursor: default;
font: var(--modal-dialog-font, bold 1em system-ui);
outline: none;
--x: 0px; --y: 0px; --transform: ;
--dialog-border: #444;
pointer-events: none;
position: relative;
overscroll-behavior: contain;
}
:host(.dotted) {
//font: var(--modal-dialog-font, caption);
}
:host(.static) {
visibility: hidden;
pointer-events: none;
font: var(--modal-dialog-font, inherit);
}
:host(:not(.static)) {
position: var(--modal-dialog-modal-absolute, fixed);
left: 0px; right: 0px; top: var(--overlay-top, 0px); height: min(100%, 100vh);
z-index: 100;
box-sizing: border-box; xborder: 10px solid gray;
display: none;
}
:host(:not(.static):not(.dotted)) {
backdrop-filter: blur(1px);
-webkit-overscroll-behavior: none; overscroll-behavior: none;
background: #8884;
pointer-events: auto;
xtransition: border-bottom 0.1s;
border-bottom: var(--overlay-bottom-size, 0px) solid transparent;
}
@media(prefers-color-scheme: dark) {
:host(:not(.static):not(.dotted))) { backdrop-filter: none; /* safari issue */ }
}
:host([visible]:not([visible="false" i])) {
display: block;
visibility: visible;
}
:host(:not([visible]:not([visible="false" i]))) #dialog slot {
display: none;
}

:host(:not(.loading):not(.inactive):not(.waiting)) #cover
{ display: none; }
:host #cover
{ position: absolute; z-index: 1; left: 0; right: 0; top: 0; bottom: 0; background: #FFF4; display: grid; place-items: center; }
:host(.waiting) #cover { background: transparent; }
:host #cover:after
{ content: " "; }
:host(:not(.loading):not(.waiting)) #cover > .answer
{ display: none; }

:host(.loading:not(.offer-update)) #cover { background: white; }

:host(.loading) #cover > .answer {
background: white; padding: 0.5em 1em; border-radius: 0.5em; border: thin solid gray;
font: caption; text-align: center; color: gray;
}
@keyframes flicker-animation {
0%   { opacity:0; }
50%  { opacity:0.3; }
100% { opacity:0; }
}
:host(.loading) #cover .answer:before
{ content: "Opening..."; opacity: 1;  }

:host(.waiting) #cover  {
opacity: 1;
xcursor: url(ui-icons/watch.png) 8 8, default; 	/* would be nice to delay the watch a little while somehow */
cursor: url(ui-icons/cursor.png) 6 0, default;
}
:host(.waiting) #cover > .answer {
animation: flicker-animation 1s 2s infinite;
background: white; padding: 0.5em 1em; border-radius: 0.5em;  border-radius: 0.5em; border: thin solid gray;
font: caption; text-align: center; opacity: 0;
}
:host(.waiting) #cover .answer:before
{ content: "Wait... (⌘ .)"; }	/* should change this to fluid [data-wait-message] or something. = wait 3 seconds, Loading..., etc */

:host(.loading.offer-update) #cover > .answer {
xbox-shadow: 0px 0px 4px gray;
}
:host(.loading.offer-update) #cover .answer:before
{ content: "This stack was changed."; display: block; font: bold 1em system-ui; color: black; padding-bottom: 0.5em; text-align: left; }
:host(:not(.offer-update)) #cover .answer button-part
{ display: none; }

:host #dialog {
position: relative;
display: inline-block;
transform-origin: top left;
transform: var(--transform);
pointer-events: var(--context-menu-none, auto);
overflow: hidden; /* This seems to trigger an xor drawing bug in safari */
}
:host(.block) #dialog {
display: block; width: 100%;
}
:host(:not(.frameless)) #dialog {
background: var(--dark-mode-softwhite, white);
border: thin solid var(--dialog-border);
xborder-radius: 2px 2px 0px 0px;
}
:host(:not(.static)) #dialog {
position: absolute; left: calc(50% + var(--x)); top: calc(50% + var(--y));
transform: var(--transform) translate(-50%,-50%) ;
box-shadow: 0px 0px 3px #444;
}
:host(.notcentered:not(.static)) #dialog {
position: absolute; left: calc(60px + var(--x)); top: calc(60px + var(--y));
transform: var(--transform);
box-shadow: 0px 0px 4px #444;
}

@media (pointer: coarse) {
:host(:not(.static)) #dialog:focus-within {
top: calc(0px + var(--y));
transform: var(--transform) translate(-50%,0%);
}
}
:host(.static) #dialog {
pointer-events: var(--context-menu-none, auto);
left: var(--override-xy-zero, var(--x)); top: var(--override-xy-zero, var(--y));
box-shadow: 1px 2px 2px #EEE;
}
:host(.current.static) #dialog {
box-shadow: 1px 1px 6px #CCC;
}
:host(.ybottom) #dialog {
position: absolute;
top: auto;
bottom: var(--override-xy-zero, var(--y));
}
:host(.vertical-layout) #dialog {
display: flex;
xflex-direction: column;
}
:host(:not([name])) #titlebar {
display: none;
}
#titlebar {
text-align: center;
display: flex; padding: 3px 2px 2px 2px;
font: var(--modal-dialog-titlebar-font, bold 1em system-ui);
touch-action: none; min-height: 1em;
xborder: thick solid purple;
}
@media (pointer: coarse) {
:host(.dotted[name]:not([name=""])) #titlebar { font-size: var(--modal-dialog-titlebar-boost, 1em); }
}
:host(.inactive) #titlebar { color: #555; }
:host(.frameless) #titlebar {
background: white;
border: thin solid currentColor;
border-bottom: thin solid #AAA8;
}
:host(:not(.frameless)) #titlebar {
xpadding: 4px 4px 0px 4px;
padding: 3px 3px 0px 3px;
xpadding-bottom: 0px;
xpadding-top: 4px;
}
:host(.nopadding) #titlebar {
border-bottom: thin solid var(--dialog-border);
padding-bottom: 2px;
}
:host #titlebar > div {
flex: 1;
xpadding-bottom: 2px;
}
:host(:not(.frameless)) #titlebar > div {
flex: 1;
padding-bottom: 1px;
}
:host(:not(.inactive)) #titlebar > div {
background: linear-gradient(to bottom, black 0%, gray 33.33%, transparent 40%, transparent 100%);
background-size: 100% 3px;
background-clip: content-box;
/*background: linear-gradient(to bottom, #444 0%, #444 50%, transparent 50%, transparent 100%);
background-size: 100% 2.5px;
margin-bottom: -1px;*/
}
:host(.dotted:not(.inactive)) #titlebar > div {
background-image: radial-gradient(#669 0.75px, #BBB2 0);
background-size: 4px 4px;
xopacity: 0;
}
:host(.dotted) #titlebar {
padding: 2px;
}
:host/*(:not(.dotted))*/ #titlebar {
margin-top: 1px;
}
:host(.closebox) #closebox, :host #zoombox {
display: inline-block; width: 1em; height: 1em; border: 1px solid currentColor; background: white; vertical-align: top;
outline: 2px solid white; box-sizing: border-box; position: relative;
}
:host #zoombox:before {
position: absolute; content: ""; left: -1px; top: -1px; width: 0.6em; height: 0.6em; border: 1px solid currentColor; box-sizing: border-box;
}
:host #zoombox:active:hover:before {
left: -2px; top: -2px; border-width: 2px; width: calc(0.6em + 0.5px); height: calc(0.6em + 0.5px);
}

:host #closebox:after, :host #zoombox:after {
position: absolute; content: ""; left: -4px; top: -4px; right: -4px; bottom: -4px; border-radius: 4px; box-sizing: border-box;
}
/*:host #titlebar:hover #closebox { box-shadow: inset 0px 0px 3px red; }
:host #titlebar:hover #zoombox { box-shadow: inset 0px 0px 4px green; }*/
:host #closebox:active:hover, :host #zoombox:active:hover {
border: 2px solid currentColor;
}
@media(pointer: coarse) {
:host #closebox:after, :host #zoombox:after
{ left: -10px; top: -10px; right: -10px; bottom: -10px; }
:host #closebox:active:after, :host #zoombox:active:after
{ background: #4444; }
}

:host(.inactive) #titlebar .boxmargin {
visibility: hidden;
}
:host(:not(.closebox)) #titlebar .boxmargin.left,
:host(:not(.zoombox)) #titlebar .boxmargin.right {
display: none;
}
:host(.inactive) #titlebar .boxmargin {
pointer-events: none;
}
:host #titlebar > #title {
display: inline-block; pointer-events: none;
background: inherit;
}
:host #titlebar > #title[data-name=""] { display: none; }
:host #titlebar > #title:after {
display: inline-block;
content: '\\A0\\A0' attr(data-name) '\\A0\\A0';
xfont: caption;
}
/* i tired of userbubble */
/*:host(.userbubble) #titlebar > #title {

border: 1px dotted #BBB; background: #BBB4; padding: 1px 3px; margin: -1px 1px;
border-radius: 2px 0.5em 2px 2px ;
}
:host(.userbubble) #titlebar > #title:after {
xcontent: '\\A0🌐\\A0' attr(data-name) '\\A0';
content: '\\A0' attr(data-name) '\\A0';
max-height: 1em; line-height: 1;
}*/

:host #content {
position: relative;
pointer-events: auto;
clip-path: inset(0px 0px);
xoverflow: auto;
}
:host(:not(.nopadding):not(.frameless)) #content {
padding: 0.5em;
margin: 3px 2px 2px 2px;
border: 2px solid black;
}
:host(.nopadding) #content {
padding: 0px;
}
</style>`);


// 'the card window' has simple properties
function card_window_delegate(element,template)
{
var md;
return {
connectToDialog(value) { md = value; },
get name() { return md.name; },
get shortName() { return md.name; },
get longName() { return md.name; },
get rectangle() { return [0,0, element.width, element.height]; },
set rectangle(value) {
var r = rectangle(value);
md.shadowRoot.qs('#content').style.overflow = 'hidden';
element.width = r[2] - r[0];
element.height = r[3] - r[1];
},
get top() { return 0; },
get left() { return 0; },
get width() { return md.shadowRoot.qs('#content').offsetWidth; },
set width(value) { md.shadowRoot.qs('#content').style.overflow = 'hidden'; md.shadowRoot.qs('#content').style.width = number(value)+'px'; },
get height() { return md.shadowRoot.qs('#content').offsetHeight; },
set height(value) { md.shadowRoot.qs('#content').style.overflow = 'hidden'; md.shadowRoot.qs('#content').style.height = number(value)+'px'; },
get scroll() { return [md.shadowRoot.qs('#content').scrollLeft, md.shadowRoot.qs('#content').scrollTop]; },
set scroll(value) {
var p = point(value);
md.shadowRoot.qs('#content').scroll({left:p[0],top:p[1],behaviour:'smooth'});
},

};
}
ElementTemplate.Create("card-window-delegate", "scroll,rectangle|rect,width,height", "",);

document.write(`<modal-dialog id="answerdialog" tabindex="0">
		<table><tbody><tr><td>
			<div id="text" style="width: 350px; margin-bottom: 0.5em">Hey, could you lorem ipso sum? </div>
		</td></tr>
			<tr><td>
				<div class="flex-row" onclick="if (event.target.matches('button-part')) {
					answerdialog.button_result = event.target.name;
					answerdialog.visible=false;
					answerdialog.callback(event.target.name);
				}">
					<button-part id="first" class="flex-expand" name="First" type="standard"></button-part>&nbsp;
					<button-part id="second" class="flex-expand" name="Second" type="standard"></button-part>&nbsp;
					<button-part id="third" class="flex-expand" name="Third" type="default"></button-part>
				</div>
			</td></tr></tbody></table>
	</modal-dialog>`);
document.write(`<modal-dialog id="askdialog" tabindex="0">
		<table><tbody><tr><td>
			<div id="text" style="width: 350px; margin-bottom: 0.5em">Hey, could you lorem ipso sum?</div>
			<field-part id="result" type="rectangle" style="margin:0;" contenteditable="true"><div>Yes</div></field-part>
		</td></tr>
			<tr><td>
				<div class="flex-row" onclick="if (event.target.matches('button-part')) {
					askdialog.button_result = (event.target.name=='Cancel') ? 'Cancel' : '';
					askdialog.text_result = askdialog.button_result ? '' : askdialog.qs('#result').contents;
					askdialog.visible=false;
					askdialog.callback(event.target.name);
				}">
					<button-part id="first" class="flex-expand" name="This button is invisible" type="standard" visible="false"></button-part>&nbsp;
					<button-part id="second" class="flex-expand" name="Cancel" type="standard"></button-part>&nbsp;
					<button-part id="third" class="flex-expand" name="OK" type="default"></button-part>
				</div>
			</td></tr></tbody></table>
	</modal-dialog>`);

function launch_answer_dialog(callback, text, first, second, third)
{
delete answerdialog.button_result;
answerdialog.qs('#text').innerText = text;
answerdialog.callback = callback;
var btns = [];	// right to left
if (third) btns.push(third);
if (second) btns.push(second);
btns.push(first || 'OK');
//console.log(btns);
answerdialog.qs('#third').visible = !!btns[0];
answerdialog.qs('#third').name = btns.shift();
answerdialog.qs('#second').visible = !!btns[0];
answerdialog.qs('#second').name = btns.shift();
answerdialog.qs('#first').visible = !!btns[0];
answerdialog.qs('#first').name = btns.shift();
answerdialog.visible=true;
answerdialog.focus();
}
function launch_ask_dialog(callback, text, defaultResult)
{
askdialog.button_result = '';
askdialog.text_result = '';
askdialog.qs('#text').innerText = text;
askdialog.qs('#result').contents = defaultResult;
askdialog.callback = callback;
askdialog.visible=true;
showandselectname(askdialog,true);
}

function showandselectname(md, evenOnMobile) {
md.visible = true;
var onMobile = ('ontouchstart' in document);
if (evenOnMobile || !(onMobile /*&& (document.activeElement===body || !document.activeElement)*/)) {
//console.log('sasn');
getSelection().selectAllChildren(md.qs("#name") || md.qs("#result"));
window.scrollTo(0,0);
if (onMobile) {
getSelection().collapseToEnd();
}
}
}

ElementTemplate.Create("packaged-answer-and-ask-boxes", "", "",);


function color_bevel_picker(element,template)
{
return {
get hasColor() { return template.qs('#hascolor').hilite; },
set hasColor(value) { template.qs('#hascolor').hilite = !!value; },
set color(value) { template.qs('#color').value = css_color_as_rgb(value || '#FFFFFF'); if (!value) element.removeAttribute('color'); },
set bevel(value) { template.qs('#bevel').value = (value || 0); }
};
}
function css_color_as_rgb(color)
{
var ctx = document.createElement('canvas').getContext('2d');
ctx.fillStyle = color;
return ctx.fillStyle;
}
ElementTemplate.Create("color-bevel-picker", "hasColor,color='#FFFFFF',bevel=0,showBevel", "",`
<button-part id="hascolor" type="checkbox" name="Color" onclick="
this.parentNode.qs('#color').value = css_color_as_rgb(this.hilite &amp;&amp; this.getRootNode().host.color || '#FFFFFF');
this.parentNode.qs('#bevel').value = this.hilite ? (this.getRootNode().host.bevel||0) : ''; "></button-part>
<input id="color" type="color" value="#FFFFFF" onmouseup="this.parentNode.qs('#hascolor').hilite = true; this.getRootNode().host.color = this.value;" oninput="this.parentNode.qs('#hascolor').hilite = true; this.getRootNode().host.color = this.value;">
<input id="bevel" type="number" min="-7" max="7" value="" style="max-width: 3em;" oninput="this.parentNode.qs('#hascolor').hilite = true; this.getRootNode().host.bevel = this.value"><br>
<style>
:host([showBevel="false" i]) #bevel { display: none; }
:host input[type=color] { filter: var(--dark-mode-inversion); }
</style>
`);
