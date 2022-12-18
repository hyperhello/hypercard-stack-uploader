<?php

/*
	
	LICENSE:
	This file was developed ©2022 Hypervariety Custom Software, LLC. There is no warranty of any kind expressed or implied.
	THIS FILE IS OPEN SOURCE. YOU CAN COPY AND RUN THIS FILE YOURSELF AND LEARN PROGRAMMING TECHNIQUES FROM IT.
	Although the code is not very well-written or pretty, in the interests of public discourse, I am making it available for view. 
	
	THANK YOU TO THE RETRO-HACKERS WHO FIGURED OUT THE HC STACK FORMAT.
	https://github.com/PierreLorenzi/HyperCardPreview/blob/master/StackFormat.md
	https://github.com/ParksProjets/Maconv
	https://github.com/uliwitness/snd2wav
	https://github.com/fuzziqersoftware/resource_dasm
	
	This php script shows a form that lets the user upload HyperCard 1.x or 2.x stacks. 
	If installed, it uses Maconv to get it out of a StuffIt archive, .dsk, or .img file.
	If installed, it uses resource_dasm to import the Mac SND, PLTE, PICT, and HCcd/HCbg resources.
	It translates the stack to a big JSON with mostly proper HC property names. 
	Then at the end, depending on the flag it either shows the JSON, sends it to the parent window, or puts the stack up on display.
	
*/

$show_errors = true;
ini_set('display_errors', $show_errors ? 1 : 0);
error_reporting($show_errors ? -1 : 0); 	// this is really hard core, in PHP 8 it's the default

$manyErrors = 0;
function e($number, $msg, $file, $line) {
	global $manyErrors;
	if (++$manyErrors > 100)
		{ echo "Too many errors! Give Up!"; exit(); }
   echo "<pre style='color:blue';>";
	echo "Error! ";
	if (isset($_GET['error']) || isset($_POST['error']))
		print_r(debug_backtrace());
	//echo substr(var_dump(debug_backtrace()), 0, 2000);
	echo "</pre>";
}
set_error_handler('e');

/* byte size limit */
$UPLOAD_BYTES_LIMIT = 35000000;
/* working directory to move uploaded file */
$SAFE_STACK_CONVERTER_UPLOADS_DIR = "stack-uploads/";
/* path to Maconv if you want to open .sit, .dsk, etc */
$MACONV_INSTALLATION_EXECUTABLE = null;
/* path to Unar unstuff for a second chance */
$UNAR_INSTALLATION_EXECUTABLE = null;
/* path to resource_dasm for SND, PICT, etc */
$RESOURCEDASM_INSTALLATION_EXECUTABLE = null;
/* path to snd2wav if you want to import type 2 SND resource files and don't have resource_dasm */
$SND2WAV_INSTALLATION_EXECUTABLE = null;
/* set to true if you want to show the stack by linking in the xtalk templates from hypercardsimulator.com */
$SHOW_PACKAGED_SOLO_STACK = true;
/* for testing resources given a local STAK */
$DEMO_DATAFORK_FILE = "";
/* for testing resources given a local .rsrc */
$DEMO_RESOURCE_FILE = "";
/* The form has a checkbox to be in japanese mode */
$nihongo_translation = !empty($_POST['nihongo']);

/* useful for setting the above constants per-system */
@include("file-system-aux.php");

/* set these to something for testing. otherwise the upload form will take care of it. */
$contents = "";
$filename = $DEMO_DATAFORK_FILE ?? "";
$possible_resource_fork = $DEMO_RESOURCE_FILE ?? "";
$found_nihongo = false;

/* typed readers given an offset into $contents */
function one($i) {
	global $contents;
	return unpack("C1", $contents, $i)[1];
}
function two($i, $signed=false) {
	global $contents;
	$out = unpack("n1", $contents, $i)[1];
	if ($signed && $out > 0x7FFF) $out = -0x8000 + ($out&0x7FFF);
	return $out;
}
function four($i) {
	global $contents;
	return unpack("N1", $contents, $i)[1];
}
function fourstr($i) {
	global $contents;
	return join('',array_map('chr', unpack("C4", $contents, $i)));
}
	
/* read string until null byte */
function nullstr($i) {
	global $contents;
	$out = "";
	while ($c=unpack("C1", $contents, $i)[1]) 
	{
		if ($c==13) $c=10;
		$out .= chr($c);
		$i++;
	}
	return $out;
}
/* read string until offset */
function sizedstr($i,$stop) {
	global $contents;
	$out = "";
	while ($i < $stop) 
	{
		$c = unpack("C1", $contents, $i)[1];
		if ($c==13) $c=10;
		$out .= chr($c);
		$i++;
	}
	return $out;
}
	
/* strings that were read from stack file need translation to modern UTF-8 */
function macroman($out)
{
	global $found_nihongo;
	global $nihongo_translation;
	
	if ($nihongo_translation)
	{
		// ok it would appear that Japanese stacks use a two-byte encoding as in http://www.rikai.com/library/kanjitables/kanji_codes.sjis.shtml
		// apparently 0x (81-9F & E0-FC) + ( 80-FF ) 
		// however, text in HC also uses regular Mac ascii for some HC characters like ≠ so lets see if we can improve this
		// new version would be able to tell the japanese difference on its own,
		// but it's eating double diacritical marks in European stacks too, like in "Espáñol". Might have to set up a criterion, like three kanji in a row.
		$english = "";
		$katakana = "";
		$result = "";
		for ($i = 0; $i < strlen($out); )
		{
			$lc = substr($out, $i, 1);
			$rc = substr($out, $i+1, 1);
			$left = ord($lc);
			$right = ord($rc);
			if (($left >= 0x81 && $left <= 0x84 && $right >= 0x3F) 
				|| ($left >= 0x87 && $left <= 0x9F && $right >= 0x3F) 
				|| ($left >= 0xE0 && $left <= 0xFC && $right >= 0x3F))
			{ 
				if (strlen($english))
					{ $result .= iconv('macintosh', 'UTF-8', $english); $english = ""; }
				$katakana .= ($lc.$rc); 
				$i += 2; 
			}
			else
			{ 
				if (strlen($katakana))
					{ $found_nihongo = true; $result .= iconv('shift-jis', 'UTF-8', $katakana); $katakana = ""; }
				$english .= ($lc); 
				$i += 1; 
			}
		}
		
		if (strlen($english))
			{ $result .= iconv('macintosh', 'UTF-8', $english); $english = ""; }
		if (strlen($katakana))
			{ $found_nihongo = true; $result .= iconv('shift-jis', 'UTF-8', $katakana); $katakana = ""; }
		/*if (!empty($katakana))
			{ echo "<pre>"; print_r($result); print_r($english); print_r(iconv('shift-jis', 'UTF-8', $katakana)); echo "</pre>"; }*/
		
		return $result;
								
		/*$result = iconv('shift-jis', 'UTF-8', $out);
		if ($result!==false) return $result;*/
	}
	
	return iconv('macintosh', 'UTF-8', $out);
}
	
/* a few utility functions */
function decodeanddivify($str) 
{ 	
	return Array('$'=>'div','$$'=>[macroman($str),Array('$'=>'br')]); 
}
function picture_or_rectangle_filter($obj)
{
	return ($obj['type']=='picture' || $obj['type']=='rectangle');
}
function escapeshellarg_rewrite($arg)
{
	return "'" . str_replace("'", "'\\''", $arg) . "'";
}
function testforstackness($target_file)
{
	if (!file_exists($target_file) || file_get_contents($target_file, false, null, 4, 4) != 'STAK')
		return "<center><font color=red>That doesn't seem to be a HyperCard stack file.</font></center>";
	
	return "";
}
function styleclass($flags) 
{ 
	$ecso = ($flags&(1<<7) ? ' group' : '').($flags&(1<<6) ? ' extend' : '').($flags&(1<<5) ? ' condense' : '').($flags&(1<<4) ? ' shadow' : '').($flags&(1<<3) ? ' outline' : '').($flags&(1<<2) ? ' underline' : '').($flags&(1<<1) ? ' italic' : '').($flags&(1<<0) ? ' bold' : '');
	return strlen($ecso) ? substr($ecso,1) : null;
}
function fontedstring($str, $style)
{
	$str = macroman($str);
	if (!isset($style['font']) && !isset($style['flags']) && !isset($style['size']))
		return $str;
	$tag = Array('$'=>'font');
	if (isset($style['flags']))
		$tag['class'] = $style['flags'];
	if (isset($style['font']))
		$tag['face'] = $style['font'];
	if (isset($style['size'])) {
		// font tag has 1 through 7 sizes, 3 is default: [ 0.63em, 0.82em, 1em, 1.13em, 1.5em, 2em, 3em ]
		// Hypercard default was 12, so that's about [ 9, 10, 12, 14, 16, 24, 36]
		// no, I want the actual sizes to appear as px. Safari just maps them to x-small, small, 3, large, x-large, xx-large, -webkit-xxx-large
		// we can correct in the card-part style I think
		$tag['size'] = ($style['size']<=9) ? 1 : (
			($style['size']<=10) ? 2 : (
			($style['size']<=12) ? 3 : (
			($style['size']<=14) ? 4 : (
			($style['size']<=24) ? 5 : (
			($style['size']<=36) ? 6 : 7)))));
	}
	$tag['$$'] = Array($str);
	return $tag;
}
	
/* recursive glob includes folder names */
function rglob($pattern, $flags = 0) 
{
	$files = glob($pattern, $flags); 
	foreach (glob(dirname($pattern).'/*', GLOB_ONLYDIR|GLOB_NOSORT) as $dir) {
		$files = array_merge($files, rglob($dir.'/'.basename($pattern), $flags));
	}
	return $files;
}

/* search for an &array element with this ['type'] and/or this ['ID']. 
if $replace is given, replace (or append) first. Then return the element or null. */
function find(&$array, $type, $ID=0, $replace=null) 
{
	foreach ($array as $key=>$p) {
		if ((!$ID || (isset($p['ID']) && $p['ID']==$ID)) 
			&& (!$type || (isset($p['type']) && $p['type']==$type))) {
			if ($replace) $array[$key] = ($p=$replace);
			return $p;
		}
	}
	if ($replace) array_push($array, $replace);
	return $replace;
}

/* read a STAK data fork */
function read_STAK_file($filename, $target_srcname)
{
	/* begin the stack read. A stack is a chain of simple blocks called STAK, CARD, etc. */
	global $contents;
	global $blocks;
	global $fonts;
	global $styles;
	global $hc1;
	global $color_data;
	global $XCMDs_stub_scripts;
	
	$contents = file_get_contents($filename);
	if ($contents===false)
	{
		echo "Couldn't open stack file.";
		return;
	}
	
	$i = 0;
	$hc1 = (four(16) < 9);
	
	$blocks = Array();
	$CARDcount = 0;
	$BKGDcount = 0;
	while ($i < strlen($contents))
	{
		$size = four($i) & 0x00FFFFF;
		$type = fourstr($i+4);
		$block = Array('type'=>$type, 'ID'=>four($i+8), 'size'=>$size, 'i'=>$i);
		if ($size < 16) { 		echo("ERROR!".json_encode($block)); break; }// last readable block
		array_push($blocks, $block);
		$i += $size;
		if ($type=='TAIL') 
			break;
		if ($type=='CARD')
			$CARDcount++;
		if ($type=='BKGD')
			$BKGDcount++;
	}
	
	//echo "<pre>"; print_r($blocks); echo "</pre>";
	
	$stack = Array('$'=>'stack-part','name'=>macroman($target_srcname ?? basename($filename)));
	
	$STAK = find($blocks, 'STAK');
	$i = $STAK['i'];
	$stack['width'] = two($i+76+2+18+16+328+2);
	if ($stack['width']==0) $stack['width'] = 512;
	$stack['height'] = two($i+76+2+18+16+328+0);
	if ($stack['height']==0) $stack['height'] = 342;
	
	$stack['buttonCSSFont'] = "12px Chicago";
	$stack['fieldCSSFont'] = "12px Geneva";
	
	$stack['shortVersion'] = one($i+108).".".(one($i+109) >> 4).(one($i+109) & 0x0F);	// like 2.41
	
	$scr = nullstr($i+76+2+18+16+328+2+262+320+512);
	$stack['script'] = macroman($scr) . $XCMDs_stub_scripts;
	
	$fonts = Array();
	$FTBL = find($blocks, 'FTBL');
	if ($FTBL)
	{
		$FTBL_count = four($FTBL['i']+16);
		$i = $FTBL['i'] + 24;
		for ($f = 0; $f < $FTBL_count; $f++)
		{
			$name = nullstr($i+2);
			$fonts[two($i)] = macroman($name);
			$i += (2 + strlen($name) + 1);
			$i += ($i % 2);
		}
		//print_r($fonts);	// [3]=>Geneva etc
	}
	
	$styles = Array();
	foreach ($blocks as $block)
	{
		if ($block['type'] != 'STBL') 
			continue;
		
		$STBL = $block;
		$STBL_count = four($STBL['i']+16);
		$i = $STBL['i'] + 24;
		for ($f = 0; $f < $STBL_count; $f++)
		{
			$style = Array();
			if (two($i+12) != 0xFFFF && isset($fonts[two($i+12)])) $style['font'] = $fonts[two($i+12)];
			if (two($i+14) != 0xFFFF) $style['flags'] = styleclass(one($i+14));
			if (two($i+16) != 0xFFFF) $style['size'] = two($i+16);
			$styles[four($i)] = $style;
		
			$i += 24;
		}
	}
		
	echo " BKGDs (".$BKGDcount.") ";
	
	$bkgnds = Array();
	foreach ($blocks as $block)
	{
		if ($block['type'] != 'BKGD') 
			continue;
		array_push($bkgnds, read_CARDorBKGD_block($block['i'], $block['size'], true));
	}
	//print_r($bkgnds);
	
	$LIST = find($blocks, 'LIST');
	$i = $LIST['i'];
	if ($hc1) $i -= 4;	// HC1 format is shifted 4 bytes.
	$pagecount = four($i+16);
	$entrysize = two($i+28);
	if ($hc1) $i += 4;	// but the list is in the same place
	
	echo " CARDs (".$CARDcount.") ";

	$cards = Array();
	for ($e = 0; $e < $pagecount; $e++)
	{
		$pageid = four($i + 48 + $e * 6);
		$oldPageI = $i;
		//echo "Searching PAGE ID ".$pageid."<br>";
		
		foreach ($blocks as $block)
		{
			if ($block['type'] != 'PAGE' || $block['ID'] != $pageid) 
				continue;
			
			// found the pageID which is a list of CARDs
			$i = $block['i']+24;
			//if ($hc1) $i -= 4;	// HC1 format is shifted 4 bytes. update: no not for this block
			
			do {
				$id = four($i);
				$nextentry = $i + $entrysize;
				if ($id != 0)
					{
						$CARD = find($blocks,'CARD', $id);
						if (isset($CARD))
							array_push($cards, read_CARDorBKGD_block($CARD['i'], $CARD['size'], false));
						else 
							echo "Missing card id ".$id;
					}
				$i = $nextentry;
			} while ($i < $block['i'] + $block['size']);
			
			break;
		}
		
		$i = $oldPageI;
	}
		
	$stack['$$'] = array_merge($bkgnds, $cards);
	return $stack;
}

/* read and return a block representing a card or background part */
function read_CARDorBKGD_block($i, $size, $isBKGD)
{
	global $contents;
	global $blocks;
	global $fonts;
	global $styles;
	global $hc1;
	global $color_data;
	
	$ID = four($i+8);
	$card = Array('$'=>($isBKGD ? 'background-part' : 'card-part'), 'ID'=>$ID, 'name'=>'');

	if ($hc1) $i -= 4;	// HC1 format is shifted 4 bytes

	$flags = two($i+20);

	if (boolval($flags&(1<<14)))
		$card['cantDelete'] = true;
	if (boolval($flags&(1<<13)))
		$card['showPict'] = false;
	if (boolval($flags&(1<<11)))
		$card['dontSearch'] = true;
	
	$bitmapid = four($i+16);
	if ($bitmapid) {
		$BMAP = find($blocks,'BMAP',$bitmapid);
		$card['WOBA'] = read_WOBA_bitmap_block($BMAP['i'],$BMAP['size']);
	}
		
	if ($isBKGD)
	{
		$partcount=two($i+36);
		$partsize=four($i+40);
		$contentscount=two($i+44);
		$cls=four($i+46);
		$i += 50;
	}
	else
	{
		$card['bkgndID'] = four($i+36);
		$partcount=two($i+40);
		$partsize=four($i+44);
		$contentscount=two($i+48);
		$cls=four($i+50);
		$i += 54;
	}
	
	/* if the HCcd/HCbg resources have been read in */
	if (!empty($color_data))
	{
		$addcolor = find($color_data, $isBKGD ? 'bg' : 'cd', $ID);
		if (isset($addcolor))
		{
			$cutdown = array_filter($addcolor['objects'], 'picture_or_rectangle_filter');
			if (count($cutdown) != 0)
			{
				$card['addColorData'] = json_encode(array_values($cutdown));
			}
		}
	}
	
	/* read in the parts */
	$partstop = $i + $partsize;
	$parts = Array();
	for ($p = 1; $p <= $partcount; $p++)
	{
		$button = (one($i+4)==1);
		$part = Array(
			'$'=>($button ? 'button-part' : 'field-part'),
			'ID'=>two($i+2),
			'name'=>macroman($pn=nullstr($i+30)),
			'type'=>Array('transparent','opaque','rectangle','roundRect','shadow','checkBox','radioButton','scrolling','standard','default','oval','popup')[$parttype=one($i+15)],
			'topLeft'=>[two($i+8,true),two($i+6,true)],
			'width'=>two($i+12)-two($i+8),
			'height'=>two($i+10)-two($i+6)
		);
		
		$flags = one($i+5);
		if ($flags&(1<<7)) $part['visible'] = false;
		if ($flags&(1<<5)) $part['dontWrap'] = true;
		if ($flags&(1<<4)) $part['dontSearch'] = true;
		if (($flags&(1<<3)) && !$button) $part['sharedText'] = true;
		if (!($flags&(1<<2)) && !$button) $part['fixedLineHeight'] = true;
		if ($flags&(1<<1)) $part['autoTab'] = true;
		if ($flags&(1<<0) && $button) $part['enabled'] = false;
		if ($flags&(1<<0) && !$button) $part['lockText'] = true;
		
		$flags = one($i+14);
		if (!($flags&(1<<7)) && $button) $part['showName'] = false;
		if ($flags&(1<<7) && !$button) $part['autoSelect'] = true;
		if ($flags&(1<<6) && !$button) $part['showLines'] = true;
		if ($flags&(1<<6) && $button) $part['hilite'] = true;
		if ($flags&(1<<6) && !$button) $part['showLines'] = true;
		if (!($flags&(1<<5)) && $button) $part['autoHilite'] = false;
		if (!($flags&(1<<5)) && !$button) $part['wideMargins'] = false;
		if ($flags&(1<<4) && $button && $isBKGD) $part['sharedHilite'] = false;
		if ($flags&(1<<4) && !$button) $part['multipleLines'] = true;
		if ($flags&15 && $button) $part['family'] = ($flags&15);

		if ($button && two($i+18) && $parttype==11)
			$part['selectedLine'] = two($i+18);
		else if ($button && two($i+18, true))
			$part['icon'] = two($i+18, true); 
		
		/*if ($parttype == 5 || $parttype == 6) {}	// don't transmit align, it does nothing
		else */if (two($i+20)==1) $part['textAlign'] = 'center'; 
		else if (two($i+20)==0xFFFF) $part['textAlign'] = 'right';

		if (isset($fonts[two($i+22)])) {
			$part['textFont'] = $fonts[two($i+22)];
			$part['textSize'] = two($i+24);
		}
		else {	// HC1? or just not there? use the mac defaults
			$part['textFont'] = Array(0=>'Chicago',2=>'New York',3=>'Geneva',4=>'Monaco',16=>'Palatino',20=>'Times',21=>'Helvetica',22=>'Courier',23=>'Symbol')[two($i+22)] ?? two($i+22);
			$part['textSize'] = two($i+24);
		}
		
		$flags = one($i+26);
		$ecso = styleclass($flags);
		if ($ecso) {
			$part['class'] = $ecso;
			$part['textStyle'] = str_replace(' ', ',', $ecso);	// HC likes comma lists or 'plain', plain will be default
		}
		
		$part['textHeight'] = two($i+28);
		
		if (!empty($addcolor))
		{
			$partcolor=find($addcolor['objects'], $button ? 'button' : 'field', $part['ID']);
			if (!empty($partcolor))
			{
				$part['color'] = $partcolor['color'];
				$part['bevel'] = $partcolor['bevel'] * ($button ? 1 : -1);
			}
		}
		
		$scr = nullstr($i+30+strlen($pn)+1+1);
		if (strlen($scr))
			$part['script'] = macroman($scr);
	
		array_push($parts, $part);
		$i += two($i);
	}
	
	if ($i != $partstop) {
		echo "hey different! $i $partstop \n";
		return null;
	}
	//echo "contentscount ".$contentscount." size ".$cls." at ".$i."\n";
	
	/* read in field contents */
	$stop = ($i+$cls);
	for ($c = 1; $c <= $contentscount; $c++)
	{
		//if ($ID == 2973) echo "<br>";

		$cid = two($i,true);		// HC stores positive ID for bg fld, negative for cd fld
		if (!$isBKGD)
			$cid = -$cid;	// now it's correct ID for layer, and for the other layer if it's negative
		
		//if ($ID == 2973) echo "cid=".$cid."<br>";

		if ($cid < 0)	// bg field text on card, which we store with negative numbers this way
			$part = Array('$'=>'div', 'slot'=>$cid, 'ID'=>$cid);	
		else 
			$part = find($parts, null, $cid);
		
		//if ($ID == 2973) echo "part=".print_r($part,true)."<br>";
		
		if ($hc1)
		{
			//echo "id $cid first four: ".one($i+2).one($i+3).one($i+4).one($i+5)."\n";
			$partcontents = nullstr($i+2);
			//echo strlen($partcontents).": ".macroman($partcontents)."DONE\n";
			
			if ($part)
			{
				$part['$$'] = array_map('decodeanddivify', explode("\n",$partcontents));
				find($parts, null, $cid, $part);
			}
			
			//if ($ID == 2973) echo "(hc1) part=".print_r($part,true)."<br>";

			$i += 2 + strlen($partcontents) + 1;
			continue;
		}

		$csize = (two($i+2)+4);
		
		//if ($i > $stop) { echo "past the contents count\n"; exit(); }
		//echo "contents size ".$csize." cid ".$cid." one($i+4) ".one($i+4)."\n";
		
		if (!$part) {
			// uncompressed stack can have obselete bg fld data, this is not an error
			//echo "isBKGD ".$isBKGD." id ".$ID." unknown cid ".$cid."<br>"; 	 
		}
		else if (one($i+4)) 
		{
			$lengthofstyles=(two($i+4) & 0x7FFF);
			$partcontents = sizedstr($i+4+$lengthofstyles,$i+$csize);
			$partcontentslength = $csize - (4+$lengthofstyles);
						
			$pci = 0; 
			$divs = Array(); $divtag = null;
			$style = Array();
			$finalsegment = false;	// each loop through fills in the contents *up to* the selected style. when $finalsegment is set we're doing a final virtual one.
			for ($si = 0; ($si < $lengthofstyles-2) || ($finalsegment=true); $si += 4) 
			{
				$nextstylechange = $finalsegment ? $partcontentslength : two($i+6+$si);
				
				while (true)	// output contents until $nextstylechange is reached
				{
					$segment = ""; $gotnewline = false;
					while ($pci < $nextstylechange && $pci < $partcontentslength && !($gotnewline=($partcontents[$pci]=="\n")))
						$segment .= $partcontents[$pci++];
					if ($segment == "" && !$gotnewline)
						break;

					if (!$divtag) 
						$divtag = Array('$'=>'div','$$'=>Array());
					if ($segment != "")
						$divtag['$$'][] = fontedstring($segment, $style);
					if ($gotnewline)	// note: do we want the BRs to be inside the font tag?
						{ $divtag['$$'][] = Array('$'=>'br'); $pci++; $divs[] = $divtag; $divtag = null; }
				}
				
				if ($finalsegment)
				{
					if ($divtag)
						{ $divs[] = $divtag; $divtag = null; }
					break;
				}
				$style = $styles[two($i+8+$si)] ?? Array();
			}

			$part['$$'] = $divs;
		}
		else if ($csize > 5) 
		{
			$partcontents = sizedstr($i+5,$i+$csize);
			//echo "This part contents size ".$csize.": ".$partcontents."\n";
			$part['$$'] = array_map('decodeanddivify', explode("\n",$partcontents));
		}

		if ($part)
			find($parts, null, $cid, $part);

		$i += $csize + ($csize % 2);
	}
	if ($i < $stop) { echo "didn't get to the contents stop by ".($stop-$i)."\n"; }	// is stop wrong or does it leave old data?
	
	$cn = nullstr($i);
	if (strlen($cn))
		$card['name'] = macroman($cn);
		
	$scr = nullstr($i+strlen($cn)+1);
	if (strlen($scr))
		$card['script'] = macroman($scr);
	
	if (count($parts)) 
		$card['$$'] = $parts;
	
	return $card;
}
	
/* return a lightly translated base64 of HC's black/white/transparent pixel art format */
function read_WOBA_bitmap_block($i, $size)
{
	global $contents;
	global $hc1;
	
	if ($hc1) $i -= 4;	// HC1 format is shifted 4 bytes
	
	$topCardRect = two($i+24);
	$leftCardRect = two($i+26);
	$bottomCardRect = two($i+28);
	$rightCardRect = two($i+30);
	$topMaskRect = two($i+32);
	$leftMaskRect = two($i+34);
	$bottomMaskRect = two($i+36);
	$rightMaskRect = two($i+38);
	$topImageRect = two($i+40);
	$leftImageRect = two($i+42);
	$bottomImageRect = two($i+44);
	$rightImageRect = two($i+46);
	$sizeOfMaskData = four($i+56);
	$sizeOfImageData = four($i+60);
	
	$a = Array();
	for ($x = 24; $x <= 46; $x+=2) array_push($a, two($i+$x));
	$mask = substr($contents, $i+64, $sizeOfMaskData);
	$image = substr($contents, $i+64+$sizeOfMaskData, $sizeOfImageData);
		
	array_push($a, base64_encode($mask), base64_encode($image));
	return $a;
}

function read_color_resource($data, $type, $id)
{
	global $contents;
	$contents = $data;
	$res = Array('type' => $type, 'ID' => $id, 'objects' => Array());
	//print_r($res);
	$i = 0;
	while ($i < strlen($contents))
	{
		$otype = one($i+0) & 0x7F;
		$hidden = (one($i+0) & 0x80) != 0;
		if ($otype==1 || $otype==2) {
			$object = Array('type' => ($otype==1) ? 'button' : 'field', 'ID'=>two($i+1), 'bevel'=>two($i+3,true),
				'color' => '#'.substr('0'.dechex(one($i+5)), -2).substr('0'.dechex(one($i+7)), -2).substr('0'.dechex(one($i+9)), -2));
			$i += 11;
		}
		else if ($otype==3) {
			$object = Array('type' => 'rectangle', 'top'=>two($i+1, true), 'left'=>two($i+3, true), 'bottom'=>two($i+5, true), 'right'=>two($i+7, true), 'bevel'=>two($i+9,true), 'color' => '#'.substr('0'.dechex(one($i+11)), -2).substr('0'.dechex(one($i+13)), -2).substr('0'.dechex(one($i+15)), -2));
			$i += 17;
		}
		else if ($otype==4) {
			$object = Array('type' => 'picture', 'top'=>two($i+1, true), 'left'=>two($i+3, true), 'bottom'=>two($i+5, true), 'right'=>two($i+7, true), 'transparent'=>one($i+9)?true:false, 'name' => macroman(sizedstr($i+11,$i+11+one($i+10))));
			$i += 11 + one($i+10);
		}
		else {
			echo "(bad color data in ".$type.$id.":".$otype.")";
			break;
		}
		if ($hidden) 
			$object['hide'] = true;
		//print_r($object);
		$res['objects'][] = $object;
	}
	//print_r($res);
	return $res;
}

/* if $possible_resource_fork is a good .rsrc, this will read some resources into php variables and others into javascript variables */
function unpack_possible_resource_fork($possible_resource_fork, &$into_fork=null)
{
	global $XCMDs_stub_scripts;
	global $contents;
	global $color_data;
	global $RESOURCEDASM_INSTALLATION_EXECUTABLE;
	global $SND2WAV_INSTALLATION_EXECUTABLE;
	
	$XCMDs_stub_scripts = "";
	$color_data = "";
	
	if (!$possible_resource_fork)
		return;
	
	if (!file_exists($possible_resource_fork) || ($contents=file_get_contents($possible_resource_fork))===false) 
	{
		echo " No res fork found.";
		return;
	}
	
	// read the resource map
	
	$data = four(0);
	$datalen = four(8);
	$map = four(4); //echo $map."\n"; 
	$maplen = four(12);
	$i_of_typelist = two($map+24); //echo $i_of_typelist."\n";
	$i_of_namelist = two($map+26); //echo $i_of_namelist."\n";
	$typecount = two($map+28,true); //echo $typecount."\n";
	//print_r(get_defined_vars());
	$i_of_reflist = two($map+$i_of_typelist+2+$typecount*8); //echo $i_of_reflist."\n";
	$types = Array();
	for ($n = 0; $n <= $typecount; $n++)
	{
		$typelistoffset = $map + $i_of_typelist + 2 + $n*8;
		$type = substr($contents, $typelistoffset, 4);
		$count = two($typelistoffset+4) + 1;	// add 1
		$offset = two($typelistoffset+6);
		
		$resources = Array();
		for ($r = 0; $r < $count; $r++)
		{
			$reflistoffset = $map + $i_of_typelist + $offset + $r*12;
			$nameoffset = two($reflistoffset+2);
			$dataoffset = four($reflistoffset+4)&0x00FFFFFF;
			$resources[] = Array(
				'ID'=>two($reflistoffset,true),
				'name'=>($nameoffset==0xFFFF)?''	// macroman?
					: macroman(substr($contents, $map + $i_of_namelist + $nameoffset + 1, one($map + $i_of_namelist + $nameoffset))),
				'data'=>base64_encode(substr($contents, $data + $dataoffset + 4, four($data + $dataoffset)))
			);
		}
		
		$types[$type] = $resources;
		//$types[] = $type;
	}
	
	//setlocale(LC_CTYPE, "en_US.UTF-8");	// escapeshellarg doesn't include utf without it like ƒ .... sigh
	
	// resource_dasm executable will convert complex resources into modern formats
	if (isset($RESOURCEDASM_INSTALLATION_EXECUTABLE))
	{
		//$resourcedasm_folder = $possible_resource_fork.'.out';
		$resourcedasm_folder = dirname($possible_resource_fork)."/".preg_replace('/[^[:print:]]/', '?', basename($possible_resource_fork)).'.out';
		$shellcmd = $RESOURCEDASM_INSTALLATION_EXECUTABLE.' --data-fork --image-format=png --target-type=PAT# --target-type=ICON --target-type=snd --target-type=CURS --target-type=PICT --save-raw=no --filename-format=%t%i '.escapeshellarg($possible_resource_fork).' '.escapeshellarg($resourcedasm_folder);
		echo shell_exec($shellcmd);
	}
	
	/* if $into_fork was passed in, put the actual ICON data into the fork */
	if (isset($types['ICON']) && isset($into_fork))
	{
		// the simulator needs to start masking icons, starting here
		// Nope, this is annoying. Include the actual ICON 128b, then mask in the client. Have to reimport! Who cares!
		
		echo " ICONs (".count($types['ICON']).") ";
		
		$icon_resources = Array();
		
		foreach ($types['ICON'] as $icon)
		{
			$res = Array('ID' => $icon['ID'], 'name' => $icon['name'], 'data' => $icon['data']);
			$icon_resources[] = $res;
		}
		
		// so these icons will be called a different name and need to be masked in the simulator
		if (isset($into_fork))
			$into_fork['importedICONResources'] = json_encode($icon_resources);

	}
	else if (isset($types['ICON']))
	{
		/* otherwise produce actual icons using inline javascript */
		echo " ICONs (".count($types['ICON']).")";
?>
<script>
	var convertedicons = <?php echo json_encode($types['ICON']); ?>;
	var workcanvas = document.createElement('canvas');
	var ImportedICONImages = {};
	convertedicons.forEach((icon)=>{
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
</script>
<?php
	}
	
	if (isset($types['snd ']))
	{
		echo " SNDs (".count($types['snd ']).")";

		$wav_resources = Array();
		$target_dir = dirname($possible_resource_fork).'/';

		foreach ($types['snd '] as $snd)
		{
			//print_r($snd);
			//echo "<br>";
			if (isset($resourcedasm_folder) && file_exists($resourcedasm_folder.'/snd'.$snd['ID'].'.wav'))
			{
				$snd['wav'] = file_get_contents($resourcedasm_folder.'/snd'.$snd['ID'].'.wav');
				$wav_resources[$snd['name']] = "data:audio/wav;base64,".base64_encode($snd['wav']);
			}
			else if (isset($SND2WAV_INSTALLATION_EXECUTABLE))
			{
				$sndfile = $target_dir.'snd_resource_file';	//.'_'.$snd['ID']
				//print_r($sndfile);
				//echo "<br>";
				file_put_contents($sndfile, base64_decode($snd['data']));
				$shellcmd = $SND2WAV_INSTALLATION_EXECUTABLE.' '.escapeshellarg($sndfile).' '.escapeshellarg($sndfile.'_'.$snd['ID'].'.wav');
				//echo $shellcmd."<br>";
				echo shell_exec($shellcmd);
				echo "<BR>";
				if (file_exists($sndfile.'_'.$snd['ID'].'.wav')) {
					$snd['wav'] = file_get_contents($sndfile.'_'.$snd['ID'].'.wav');	// could make this the same file name too
					$wav_resources[$snd['name']] = "data:audio/wav;base64,".base64_encode($snd['wav']);
				}
			}
		}
		
		if (isset($into_fork))
			$into_fork['importedWAVs'] = json_encode($wav_resources);
		else 
		{
?>
<script>
	var ImportedWAVResources = <?php echo json_encode($wav_resources); ?>;
</script>
<?php
		}
	}
		
	if (isset($types['XCMD']))
		foreach ($types['XCMD'] as $x)
			$XCMDs_stub_scripts .= ("\n\n on ".$x['name']."\n -- XCMD resource ID ".$x['ID']."\nend ".$x['name']);
	if (isset($types['XFCN']))
		foreach ($types['XFCN'] as $x)
			$XCMDs_stub_scripts .= ("\n\n function ".$x['name']."\n -- XFCN resource ID ".$x['ID']."\nend ".$x['name']);
	
	if (isset($types['PLTE']))
	{
		echo " PLTEs (".count($types['PLTE']).")";
		
		$plte_resources = Array();
		
		foreach ($types['PLTE'] as $plte)
		{
			$contents = base64_decode($plte['data'],true);
			// followed by count of { rect, short, pstring, [alignment byte] }
			$palette = Array('PLTE' => $plte['ID'], 'WDEF' => (two(2) - two(2)%16)/16, 'showName' => (two(2)%16 & 1)!=0, 'selection' => two(4,true), 'frame' => (two(6)!=0), 'PICT' => two(8), 'top' => two(10), 'left' => two(12), 'count' => two(22), 'buttons' => Array());
			$i = 24;
			for ($b = 0; $b < $palette['count']; $b++)
				{
					$palette['buttons'][] = Array('top'=>two($i+0),'left'=>two($i+2),'bottom'=>two($i+4),'right'=>two($i+6),'message'=>macroman(sizedstr($i+11,$i+11+one($i+10))));
					$i += 11 + one($i+10) + 1 - (one($i+10)%2);
				}
			if (isset($resourcedasm_folder) && file_exists($resourcedasm_folder.'/PICT'.$palette['PICT'].'.png'))
				{
					$palette['bitmap'] = 'data:image/png;base64,'.base64_encode(file_get_contents($resourcedasm_folder.'/PICT'.$palette['PICT'].'.png'));
				}
			else if (isset($resourcedasm_folder) && file_exists($resourcedasm_folder.'/PICT'.$palette['PLTE'].'.png'))
				{
					// try the PLTE id instead.
					$palette['bitmap'] = 'data:image/png;base64,'.base64_encode(file_get_contents($resourcedasm_folder.'/PICT'.$palette['PLTE'].'.png'));
				}
			
			//print_r($palette);
			$plte_resources[$plte['name']] = $palette;
		}
		
		if (isset($into_fork))
			$into_fork['importedPLTEs'] = json_encode($plte_resources);
		else
		{
?>
	<script>
		var ImportedPLTEResources = <?php echo json_encode($plte_resources); ?>;
	</script>
<?php
		}
	}

	if (isset($types['HCcd']) || isset($types['HCbg']))
	{
		echo ' <span style="color:#FF0000">C</span><span style="color:#CCFF00">o</span><span style="color:#00FF66">l</span><span style="color:#0066FF">o</span><span style="color:#CC00FF">r</span> ('.(count($types['HCcd'] ?? Array())+count($types['HCbg'] ?? Array())).')';
		
		$color_data = Array();
		if (isset($types['HCcd'])) foreach ($types['HCcd'] as $res)
			$color_data[] = read_color_resource(base64_decode($res['data']), 'cd', intval($res['name']));
		if (isset($types['HCbg'])) foreach ($types['HCbg'] as $res)
			$color_data[] = read_color_resource(base64_decode($res['data']), 'bg', intval($res['name']));
		
	}

	if (isset($types['PICT']))
	{
		echo " PICTs (".count($types['PICT']).") ";
		
		$pict_resources = Array();
		
		foreach ($types['PICT'] as $pict)
		{
			$res = Array('name' => $pict['name']);
			if (isset($resourcedasm_folder) && file_exists($resourcedasm_folder.'/PICT'.$pict['ID'].'.png'))
			{
				$res['bitmap'] = 'data:image/png;base64,'.base64_encode(file_get_contents($resourcedasm_folder.'/PICT'.$pict['ID'].'.png'));
			}
			else if (isset($resourcedasm_folder) && file_exists($resourcedasm_folder.'/PICT'.$pict['ID'].'.png'))
			{
				// try the PLTE id instead.
				$res['bitmap'] = 'data:image/png;base64,'.base64_encode(file_get_contents($resourcedasm_folder.'/PICT'.$pict['ID'].'.png'));
			}
			$pict_resources[$pict['ID']] = $res;
		}

		if (isset($into_fork))
			$into_fork['importedPICTs'] = json_encode($pict_resources);
		else
		{
?>
	<script>
		var ImportedPICTResources = <?php echo json_encode($pict_resources); ?>;
	</script>
<?php
		}
	}

	if (isset($types['CURS']) && !empty($resourcedasm_folder))
	{
		echo " CURSs (".count($types['CURS']).") ";
		
		$curs_resources = Array();
		
		foreach ($types['CURS'] as $curs)
		{
			$cursorfile = "";
			foreach (glob($resourcedasm_folder.'/CURS'.$curs['ID'].'_*.png') as $cursorfile)
				break;
			if ($cursorfile)
			{
				$res = Array('name' => $curs['name'], 'x' => intval(explode("_",$cursorfile)[1]), 'y' => intval(explode("_",$cursorfile)[2]));
				$res['bitmap'] = 'data:image/png;base64,'.base64_encode(file_get_contents($cursorfile));
				$curs_resources[$curs['ID']] = $res;
			}
		}
		
		if (isset($into_fork))
			$into_fork['importedCURSResources'] = json_encode($curs_resources);
		else
		{
?>
	<script>
		var ImportedCURSResources = <?php echo json_encode($curs_resources); ?>;
	</script>
<?php
		}
	}
}

/* show a form for uploading a file */
function output_form()
{
	global $UPLOAD_BYTES_LIMIT;
	global $nihongo_translation;
?>

	<script>
		function inspectInput(form)
		{
			var size = form.fileToUpload.files[0].size;
			if (size > <?php echo $UPLOAD_BYTES_LIMIT; ?>) { output.innerText = "File too large. <?php echo round($UPLOAD_BYTES_LIMIT/1000000); ?>M max please."; return false; } 
			output.innerText = 'Selected ' + Math.round(size/1000) + 'K file.';
			return true;
		}
	</script>
	<form id=uploadform method="post" enctype="multipart/form-data" style="display: flex; flex-direction: column;" onsubmit="
		if (!inspectInput(this)) { event.preventDefault(); return false; } 
		if (document.getElementById('importerresults')) 
			importerresults.innerHTML = '';
		output.innerHTML += '\n<b class=attention>Now uploading file. Please be patient...</b>';
		if (window.archivepickerform)
			window.archivepickerform.parentNode.removeChild(archivepickerform);
		fileToUpload.scrollIntoView();
		console.log('Submitting form...'); 
		return true;">
		<input type="hidden" name="nihongo" id="nihongo" <?php if ($nihongo_translation) echo "value=true"; ?> >
		<div style='text-align: left;'>&nbsp;&nbsp;<code>.dsk</code> , <code>.img</code> , <code>.bin</code> , <code>.sit</code> , <code>.hqx</code> , or raw file:</div>
		<div style="flex: 1; display: flex; flex-direction: row; align-items: center;">
			<input type="file" name="fileToUpload" id="fileToUpload" oninput="
				if (document.readyState!='complete' || !inspectInput(this.form)) return;
				if (this.form.onsubmit())
					this.form.submit();
				" style="padding: 0.5em 0px; border: 0.25em dashed gray; border-radius: 0.5em; flex: 1; align-self: stretch;">
			<input type="hidden" value="convert" name="convert" id="convert">
			<input type="submit" value="Upload" name="dosubmit" id="dosubmit">
		</div>
	</form>	
	<div id=output style='padding-top: 10vh; padding-bottom: 40vh;'>
	</div>

<?php
}

/* if an archive was uploaded, we unpacked it, and the user needs to pick a file */
function output_archive_picker_form($friendly_archive_name, $previous_filename)
{	
	global $SAFE_STACK_CONVERTER_UPLOADS_DIR;
	global $nihongo_translation;
		
	$target_dir = $SAFE_STACK_CONVERTER_UPLOADS_DIR;
	$maconv_output_folder = $target_dir."maconv-results/".$friendly_archive_name;
	
	$firstlevel = Array();
	$cwd = getcwd();
	if (chdir($maconv_output_folder))
		{
			$firstlevel = (rglob('*'));	// try this instead
			//print_r($firstlevel);
			
			foreach ($firstlevel as $c) {
				//echo "<br>does file ".$c." exist:".file_exists($c)."<br>";
				
				//$newc = htmlspecialchars($c,ENT_QUOTES | ENT_IGNORE,"ISO-8859-1",true);
				$newc = preg_replace('/[^[:print:]]/', '?', $c);
				if (file_exists($c) && strcmp($c,$newc))
					rename($c, $newc);
				
				//echo "<br>does file ".$newc." exist:".file_exists($newc)."<br>";
			}
			
			$firstlevel = (rglob('*'));	// try this instead
			//print_r($firstlevel);
			
			chdir($cwd);
		}
	
	//htmlspecialchars(var_dump($firstlevel),ENT_HTML401,"ISO-8859-1",true);
	
	//$firstlevel = array_reverse($firstlevel);
	$candidates = Array();
	
	$target_srcname = '';
	$possible_resource_fork = "";
	foreach ($firstlevel as $target_file)
	{
		if ($target_file=='' || $target_file=='.' || $target_file=='..') 
			continue;
		if (substr($target_file,0,2)=='./') $target_file = substr($target_file,2);
		if (is_file($maconv_output_folder.'/'.$target_file) && empty(testforstackness($maconv_output_folder.'/'.$target_file)))
			{
				$filename = $target_file;
				
				array_push($candidates, $target_file);
				
				$target_srcname = $target_file;
				$possible_resource_fork = $maconv_output_folder.'/'.$target_file.'.rsrc';
				//break;
			}
	}
	
	if (empty($target_srcname))
	{
		return false;
		echo "<center><h3><font color=red>Could not locate a HyperCard stack file in archive.</font></h3></center>";
	}
	else if (count($candidates) >= 1)
	{
		$filename = "";
		
		echo "<form method=post id=archivepickerform onsubmit=\"if (document.getElementById('importerresults')) importerresults.innerHTML = ''; this.scrollY.value = window.scrollY; \">";
		echo "<input type=hidden name=whicharchive value=\"".htmlspecialchars($friendly_archive_name)."\">";
		echo "<input type=hidden name=nihongo id=nihongo ".($nihongo_translation ? "value=true" : "").">";
		echo "<input type=hidden name=scrollY id=scrollY>";
		echo /*"‘".htmlspecialchars($uploadname)."’"*/ "Found ".count($candidates)." stacks, select one to import:<br><br>";
		$first=true;
		//echo "[".$previous_filename."]<br>";	// would be better to reselect the previously chosen archive!!
		foreach ($candidates as $c)
		{
			// the value="" is empty when there is a 'bad' char in the filename.
			$long = htmlspecialchars($friendly_archive_name."/".$c,ENT_HTML401,"ISO-8859-1",true);
			$short = htmlspecialchars($c,ENT_HTML401,"ISO-8859-1",true);
			//echo '['.$maconv_output_folder.'/'.$c.']';
			if (file_exists($maconv_output_folder.'/'.$c) && !is_dir($maconv_output_folder.'/'.$c))
			{
				$filesize = filesize($maconv_output_folder.'/'.$c) 
					+ (file_exists($maconv_output_folder.'/'.$c.".rsrc") ? filesize($maconv_output_folder.'/'.$c.".rsrc") : 0);
				echo "<label><input type=radio name=whichimport value=\"".$long."\" ".(($previous_filename==($maconv_output_folder.'/'.$c)) ? "checked=true" : "")."> ".$short." (".ceil($filesize/1000)."K) <input type=submit value='Import' onclick=\"this.parentNode.querySelector('input[type=radio]').checked=true;\"> </label><br>";
			}
			$first = false;
		}
		echo "</form><br>";
		echo "Import another:";
		output_form();
		return true;
	}
	else if (count($candidates) == 1)
	{
		// i'm not getting the resource fork location correct! so i changed >1 to >=1 above. fix later
		return $target_file;
		//return $friendly_archive_name."/".$candidates[0];
	}
}

/* there's a minimal batch convert interface */
function output_batch_interface()
{
	global $MACONV_INSTALLATION_EXECUTABLE;
	global $UNAR_INSTALLATION_EXECUTABLE;
	global $found_nihongo;
	
	$cwd = getcwd();
	if (!is_dir('../batch-work/upload'))
		mkdir('../batch-work/upload', null, true);
	
	chdir('../batch-work/upload');
	$files = rglob("*");
	echo "<pre style='overflow: auto; max-height: 50vh; border: thin dotted black; max-width: 80vw;'>";
	print_r($files);
	echo "</pre>";
	
	if (!isset($_GET['start']))
		return;

	if (!is_dir('../convert'))
		mkdir('../convert',0755, true);

	$start = $end = intval($_GET['start']);
	if (isset($_GET['end']))
		$end = intval($_GET['end']);
	//echo $start.'–'.$end;
	
	for ($index = $start; $index <= $end && $index < count($files); $index++)
	{
		$file = $files[$index];
		if (substr($file,0,2)=='./') $file = substr($file, 2);
		echo "\n\n[<a href='?batch&start=".$index."'>".$index."</a>] ".$file." (".round(filesize($file)/1000)."K)";
		chdir('../convert');
		echo "\n".($file)." ";
		if (!is_dir($file))
			mkdir(($file),0755,true);	// include the file name in the dir, if it is a file
		chdir('../upload');
		if (is_dir($file) || pathinfo($file,PATHINFO_EXTENSION) == 'txt')
			continue;

		$found_nihongo = false;
		
		echo "<pre style='overflow: auto; max-height: 30vh; max-width: 80vw;'>";

		// we are in upload
		// if the file is A/B/C.file, copy it to ../convert/A/B/C.file/C.file
		$target_file = $file."/".basename($file);
		copy($file, "../convert/".$target_file);
		
		chdir($cwd);
		$target_file = "../batch-work/convert/".$target_file;
		$error = "";
		$examine_archive_output = false;
		
		if (pathinfo($target_file,PATHINFO_EXTENSION) != 'hqx'
			&& strpos(file_get_contents($target_file),"(This file must be converted with BinHex 4.0)") !== false
			&& rename($target_file,$target_file.'.hqx')===true
			&& ($target_file=$target_file.'.hqx'))
		{
			// if we got here, it renamed the extension hqx, for the next clause
		}
		
		if (pathinfo($target_file,PATHINFO_EXTENSION) == 'hqx'
			&& shell_exec("python3 hcuremovehqx.py ".escapeshellarg_rewrite($target_file)." ".escapeshellarg_rewrite(substr($target_file,0,-4))." 2>&1") 
			&& file_exists(substr($target_file,0,-4))
			&& ($target_file=substr($target_file,0,-4)))
		{
			// if we got here, it's been unbinhexed
		}
		
		if (empty(testforstackness($target_file)))
		{
			// it's a stack file, continue
			$stack = read_STAK_file($target_file, basename($target_file));
			$output_file = "../batch-work/results/".preg_replace("/[^\w\/]/", "-", $file).".stack.json";
			if (!is_dir(dirname($output_file)))
				mkdir(dirname($output_file), 0755, true);
			file_put_contents($output_file, json_encode($stack));
			echo "Saved as ".$output_file;
		}
		else if (!empty($MACONV_INSTALLATION_EXECUTABLE))
		{
			$maconv_output_folder = dirname($target_file)."/maconv.out";
			echo shell_exec("rm -r " . escapeshellarg_rewrite($maconv_output_folder));
			// -v flag for verbose
			echo shell_exec($MACONV_INSTALLATION_EXECUTABLE." e ".escapeshellarg_rewrite($target_file)." ".escapeshellarg_rewrite($maconv_output_folder)." 2>&1");
			echo "\n";
			
			if (!is_dir($maconv_output_folder) || 0 == count(glob($maconv_output_folder.'/*')))
			{
				if (file_get_contents($target_file, false, null, 0, 4) == 'SIT!' || file_get_contents($target_file, false, null, 0, 2) == 'ST')
					echo "Could not open it. (StuffIt v1 and v5 supported, this was v" . ord(file_get_contents($target_file, false, null, 14, 1)) . ")";
				else if (pathinfo($target_file,PATHINFO_EXTENSION)=='sit')
					echo "Could not open it, despite being .SIT.";
				else
					echo "Could not open it.";
				
				if (!empty($UNAR_INSTALLATION_EXECUTABLE))
				{
					// apparently unstuff -d destination does nothing, it must drop its files in the current folder.
					// try this: move the .sit to the maconv folder, make that the current dir, and run unstuff. 
					$UNAR_INSTALLATION_EXECUTABLE_rp = realpath($UNAR_INSTALLATION_EXECUTABLE);
					if (!file_exists(dirname($target_file).'/maconv.out'))
						@mkdir(dirname($target_file).'/maconv.out');
					rename($target_file, dirname($target_file).'/maconv.out/'.basename($target_file));
					chdir(dirname($target_file).'/maconv.out');
					$unar_command = $UNAR_INSTALLATION_EXECUTABLE_rp." -m=yes ".escapeshellarg_rewrite(basename($target_file))." 2>&1";
					echo " Trying Unar: ".$unar_command."\n";
					echo shell_exec($unar_command);
					chdir($cwd);
					
					/*chdir(dirname($target_file));
					//echo shell_exec('ls 2>&1');
					if (!file_exists('maconv.out'))
						@mkdir('maconv.out');	// need this or it will poo in the current folder
					chdir('maconv.out');
					$unar_command = $UNAR_INSTALLATION_EXECUTABLE_rp." -m=yes ".escapeshellarg_rewrite('../'.basename($target_file))." 2>&1";
					echo " Trying Unar: ".$unar_command."\n";
					echo shell_exec($unar_command);
					chdir($cwd);*/

					/*@mkdir($maconv_output_folder);	// need this or it will poo in the current folder
					$unar_command = $UNAR_INSTALLATION_EXECUTABLE." -m=yes --destination=".escapeshellarg_rewrite(($maconv_output_folder))." ".escapeshellarg_rewrite(($target_file))." 2>&1";
					echo " Trying Unar: ".$unar_command;
					echo shell_exec($unar_command);*/

					if (is_dir($maconv_output_folder) && count(glob($maconv_output_folder.'/*')))
					{
						$examine_archive_output = true;
						echo " Unar success. ";
						
						// Unar makes funny named folders. glob cannot see a directory "directoryƒ" at all. LS can, so we use LS to fix some unar unstuff.
						chdir($maconv_output_folder);
						$betterlist = shell_exec('ls 2>&1');
						//print_r(explode("\n",$betterlist));
						foreach (explode("\n",$betterlist) as $num=>$bl)
						{
							//echo '{'.$bl.' '.is_dir($bl).'}';
							if (is_dir($bl))
								rename($bl, preg_replace('/[\x00-\x1F\x7F-\xFF]/','?',$bl)."_".$num);
						}
						chdir($cwd);
					}
				}
			}
			else 
			{
				$examine_archive_output = true;
			}
		}

		if ($examine_archive_output)
		{
			chdir($maconv_output_folder);
			
			// glob cannot see a directory "directoryƒ" at all. LS can, so we use LS to fix some unar unstuff.
			/*$betterlist = shell_exec('ls 2>&1');
			print_r(explode("\n",$betterlist));
			foreach (explode("\n",$betterlist) as $num=>$bl)
			{
				echo '{'.$bl.' '.is_dir($bl).'}';
				if (is_dir($bl))
					rename($bl, preg_replace('/[\x00-\x1F\x7F-\xFF]/','?',$bl)."_".$num);
			}
			$betterlist = shell_exec('ls 2>&1');
			print_r(explode("\n",$betterlist));*/
			/*foreach (explode("\n",$betterlist) as $bl)
			{
				echo '{'.$bl.' '.is_dir($bl).'}';
				if (is_dir($bl))
					rename($bl, $bl."renamed");
			}
			print_r(glob('*',GLOB_NOSORT));	// glob doesn't see CW Battles DEMO� folder at all...I think that's a ƒ
			*/
			
			$firstlevel = rglob('*');
			foreach ($firstlevel as $c)
			{
				$newc = preg_replace('/[^[:print:]\/]/', '?', $c);
				$newc = preg_replace('/[.][.]/', '?', $newc);
				if (file_exists($c) && strcmp($c,$newc))
					rename($c, $newc);
			}
			$firstlevel = rglob('*');
			chdir($cwd);
			
			print_r($firstlevel);

			foreach ($firstlevel as $target_file)
			{
				if (substr($target_file,0,2)=='./') $target_file = substr($target_file,2);
				if ($target_file=='' || $target_file=='.' || $target_file=='..') 
					continue;
				
				if (is_file($maconv_output_folder.'/'.$target_file) && empty(testforstackness($maconv_output_folder.'/'.$target_file)))
				{
					echo basename($target_file)." ";
					$into_fork = Array();
					unpack_possible_resource_fork($maconv_output_folder.'/'.$target_file.".rsrc", $into_fork);
					//print_r($into_fork);
					$stack = read_STAK_file($maconv_output_folder.'/'.$target_file, basename($target_file));
					$stack = array_merge($stack,$into_fork);
					
					// the grand finale!
					//$output_file = "../batch-work/results/".$file."/".$target_file.".stack.json";
					$output_file = "../batch-work/results/".preg_replace("/[^\w\/]/", "-", $file)."/". preg_replace("/[^\w\/]/", "-",$target_file).".stack.json";
					if (!is_dir(dirname($output_file)))
						mkdir(dirname($output_file), 0755, true);
					$json_out = json_encode($stack);
					file_put_contents($output_file, $json_out);
					echo "\n" .($found_nihongo ? " JAPANESE " : "")."(".round(strlen($json_out)/1000)."K). ".$output_file."\n";
				}
			}
		}
		
		echo "</pre>";
		
		chdir('../batch-work/upload');
		flush();
	}
	
	chdir($cwd);
?>
	<br><br>
	All Finished<br><br>
	<input type=button value="+1" onclick="location.href = '?batch&start=<?php echo $end+1; ?>'; ">
	<input type=button value="+10" onclick="location.href = '?batch&start=<?php echo $end+1; ?>&end=<?php echo $end+11; ?>'; ">
	<input type=button value="+100" onclick="location.href = '?batch&start=<?php echo $end+1; ?>&end=<?php echo $end+101; ?>'; ">
	<input type=button value="+1000" onclick="location.href = '?batch&start=<?php echo $end+1; ?>&end=<?php echo $end+1001; ?>'; ">
	<input type=button value="+100000" onclick="location.href = '?batch&start=<?php echo $end+1; ?>&end=<?php echo $end+100001; ?>'; ">
<?php
}

/* start the page render */
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
?>
<!DOCTYPE html>
<meta charset=utf-8><meta name=viewport content='width=device-width, height=device-height, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover'>
<style>
html,body { min-height: 100%; height: 100%; box-sizing: border-box; margin: 0; padding: 4px; }
body.drag-target #uploadform
{
	position: fixed;
	left: 0px; top: 0px; right: 0px; bottom: 0px; 
	background: #F8F8F8;
	z-index: 2;
}
.attention {
	animation: attention 1s infinite alternate;
}
@keyframes attention {
  from {color: black;}
  to {color: blue;}
}
</style>
<script>
var dragtarget = null, showeddragmodal = false;
setTimeout(()=>{
	document.body.addEventListener('dragenter', (event) => { 
		if (!event.dataTransfer.types.includes('Files')) return;
		dragtarget = event.target;
		document.body.classList.toggle('drag-target', true);
	});
	document.body.addEventListener('dragleave', (event) => { 
		if ((event.target === dragtarget || event.target===document))
			document.body.classList.toggle('drag-target', false);
	});
	document.body.addEventListener('drop', (event) => { 
		if ((event.target === dragtarget || event.target===document))
			document.body.classList.toggle('drag-target', false);
	});
}, 1);
function set_nihongo(value)
{
	console.log('set nihongo '+!!value);
	Array.from(document.forms).forEach((f)=>{ if (f.nihongo) f.nihongo.value = value || ''; });
}
</script>

<label style='float: right; background: #EEE; border-radius: 6px; padding: 0.25em; position: sticky; top: 8px;'>
	<input type=checkbox <?php echo ($nihongo_translation ? "checked" : ''); ?> oninput='set_nihongo(this.checked);'>日本語
</label>

<?php

/* convert lots of stacks on server */
if (isset($BATCH_INTERFACE_KEYWORD) && isset($_GET[$BATCH_INTERFACE_KEYWORD]))
{
	output_batch_interface();
	return;
}

/* did the client select a stack from an archive */
if (isset($_POST['whichimport']))
{
	$maconv_output_folder = $SAFE_STACK_CONVERTER_UPLOADS_DIR."maconv-results/";
	
	$target_srcname = str_replace("/../","",$_POST['whichimport']);	// need to strip any dotty business
	$target_file = $maconv_output_folder.$target_srcname;
	
	//echo $target_file;
	
	$error = testforstackness($target_file);
	if (!empty($error))
		echo $error;
	else
	{
		$filename = $target_file;
		$possible_resource_fork = $maconv_output_folder.$target_srcname.'.rsrc';
		$target_srcname = explode("/", $target_srcname, 2)[1];
	}
}

if (!$filename && isset($_POST['convert']))
{
	$target_dir = $SAFE_STACK_CONVERTER_UPLOADS_DIR;
	if (!is_dir($target_dir))
		@mkdir($target_dir);
	$uploadname = basename($_FILES["fileToUpload"]["name"]);
	$target_srcname = $uploadname;
	$target_file = $target_dir . $target_srcname;
	
	//echo $target_file;

	// Check file size
	if ($_FILES["fileToUpload"]["size"] > $UPLOAD_BYTES_LIMIT) 
		echo "<center><font color=red>Sorry, “Mr IIfx”, that file is too large.</font></center>";
	else if (!move_uploaded_file($_FILES["fileToUpload"]["tmp_name"], $target_file)) 
		echo "<center><font color=red>Sorry, there was an error uploading your file.</font></center>";
	else if (pathinfo($target_file,PATHINFO_EXTENSION) != 'hqx'
		&& strpos(file_get_contents($target_file),"(This file must be converted with BinHex 4.0)") !== false
		&& rename($target_file,$target_file.'.hqx')===true
		&& ($target_file=$target_file.'.hqx')
		&& false)
	{
		// if we got here, it renamed the extension hqx, for the next clause
	}
	else if (pathinfo($target_file,PATHINFO_EXTENSION) == 'hqx'
		&& shell_exec("python3 hcuremovehqx.py ".escapeshellarg_rewrite($target_file)." ".escapeshellarg_rewrite(substr($target_file,0,-4))." 2>&1") 
		&& file_exists(substr($target_file,0,-4))
		&& ($target_file=substr($target_file,0,-4))
		&& false)
	{
		// if we got to the &&false, it's been unbinhexed and we can continue; otherwise it was not done
		//echo "<center><font color=red>Could not open .hqx file.</font></center>";
	}
	else if (empty(testforstackness($target_file)))
	{
		// it's a stack file, continue
		$filename = $target_file;
	}
	else if (!empty($MACONV_INSTALLATION_EXECUTABLE))
	{
		// try to unstuff with the beautiful Maconv software
		//	echo "<center><h3>Maconv decompressing....</h3></center>";
		//	echo "<pre>".shell_exec($MACONV_INSTALLATION_EXECUTABLE." --help")."\n</pre>";
		$friendly_archive_name = preg_replace('/[^A-Za-z0-9\-\_]/', '-', $target_srcname);
		$maconv_output_folder = $target_dir."maconv-results/".$friendly_archive_name;
		echo "<pre style='display:none;'>\n";
		/*echo $target_file."<br>";
		echo escapeshellarg($target_file)."<br>";
		echo escapeshellarg_rewrite($target_file)."<br>";*/
		echo shell_exec("rm -r " . escapeshellarg($maconv_output_folder));
		//echo $MACONV_INSTALLATION_EXECUTABLE." e ".escapeshellarg($target_file)." ".escapeshellarg($maconv_output_folder)."<br>";
		echo shell_exec($MACONV_INSTALLATION_EXECUTABLE." e ".escapeshellarg_rewrite($target_file)." ".escapeshellarg($maconv_output_folder));
	//	echo "<pre>".shell_exec($MACONV_INSTALLATION_EXECUTABLE." -v e ".escapeshellarg($target_file).' '.escapeshellarg($maconv_output_folder))."\n</pre>";
		//$firstlevel = explode("\n", shell_exec('ls '.escapeshellarg($maconv_output_folder)));
		//print_r($firstlevel);
		
		if (!is_dir($maconv_output_folder) || 0 == count(glob($maconv_output_folder.'/*')))
		{
			if (!empty($UNAR_INSTALLATION_EXECUTABLE))
			{
				// second chance with the UNAR executable
				//echo shell_exec($UNAR_INSTALLATION_EXECUTABLE." -m=yes -d=".escapeshellarg_rewrite($maconv_output_folder)." ".escapeshellarg_rewrite($target_file)." 2>&1");
				
				$UNAR_INSTALLATION_EXECUTABLE_rp = realpath($UNAR_INSTALLATION_EXECUTABLE);
				if (!file_exists($maconv_output_folder))
					@mkdir($maconv_output_folder);
				rename($target_file, $maconv_output_folder.'/'.basename($target_file));
				$cwd = getcwd();
				chdir($maconv_output_folder);
				$unar_command = $UNAR_INSTALLATION_EXECUTABLE_rp." -m=yes ".escapeshellarg_rewrite(basename($target_file))." 2>&1";
				echo " Trying Unar: ".$unar_command."\n";
				echo shell_exec($unar_command);
				chdir($cwd);

				if (is_dir($maconv_output_folder) && count(glob($maconv_output_folder.'/*')))
				{
					// Unar makes funny named folders. glob cannot see a directory "directoryƒ" at all. LS can, so we use LS to fix some unar unstuff.
					// also it tends to drop files in the current directory for some reason some problems.
					$cwd = getcwd();
					chdir($maconv_output_folder);
					$betterlist = shell_exec('ls 2>&1');
					//print_r(explode("\n",$betterlist));
					foreach (explode("\n",$betterlist) as $num=>$bl)
					{
						//echo '{'.$bl.' '.is_dir($bl).'}';
						if (is_dir($bl))
							rename($bl, preg_replace('/[\x00-\x1F\x7F-\xFF]/','?',$bl)."".$num);
					}
					chdir($cwd);
				}
			}
		}

		echo "</pre>\n";

		if (!is_dir($maconv_output_folder) || 0 == count(glob($maconv_output_folder.'/*')))
		{
			/*if (file_get_contents($target_file, false, null, 0, 4) == 'SIT!' || file_get_contents($target_file, false, null, 0, 2) == 'ST')
				$error = "<center><font color=red>Could not open “".htmlentities($target_srcname)."” (StuffIt v1 and v5 supported, this was v" . ord(file_get_contents($target_file, false, null, 14, 1)) . ")</font></center>";
			else*/
				$error = "<center><font color=red>Could not open “".htmlentities($target_srcname)."”.</font></center>";
		}
		else 
		{
			$picker_form_result = output_archive_picker_form($friendly_archive_name, $filename);
			if ($picker_form_result === false)
			{
				$error = "<center><font color=red>Could not locate any HyperCard stack files.</font></center>";
			}
			else if ($picker_form_result === true)
			{
				return;
			}
			else 
			{
				$target_srcname = $picker_form_result;
				$possible_resource_fork = $maconv_output_folder.'/'.$picker_form_result.'.rsrc';	// just changed, maybe work?
			}
		}
		
		if (!empty($error))
		{
			echo $error;
			file_put_contents($target_file.".failed", $error);
			unset($target_srcname);
		}
	}
	else
	{
		$error = testforstackness($target_file);
		if (!empty($error))
		{
			echo $error;
			unset($target_srcname);
		}
		else
		{
			$filename = $target_file;
		}
	}

	if (!empty($error))
	{
		output_form();
		return;
	}
}


if (isset($target_srcname))
{
?>
<div id=importerresults style="position: fixed; bottom: 0px; right: 0px; background: white; z-index: 1; 
	max-height: 50%; max-width: 100%; border: thin dotted gray; overflow: auto; padding: 4px; box-sizing: border-box; ">
<?php
}
	
// start by reading in the resources so they're ready to go
unpack_possible_resource_fork($possible_resource_fork);

if (!$filename)
{
?>
	<label style='float: right; display: none; background: #EEE; border-radius: 6px; padding: 0.25em;'>
		<input type=checkbox name=nihongo <?php if ($nihongo_translation) echo "checked"; ?> oninput="set_nihongo(this.checked);">日本語</label>
	<b><font size='+1'> 💾 HyperCard Stack Importer<br><br></font></b>
<?php
	output_form();
	return;
}
	
/*if (!$SHOW_PACKAGED_SOLO_STACK)
{
	echo "<body style='padding-bottom: 50%;'>";
	//echo " <b>Reading stack...</b><br>";
	flush();
}*/

$stack = read_STAK_file($filename, $target_srcname);

if ($SHOW_PACKAGED_SOLO_STACK)
{
	echo "</div>";
	/* Output the JSON as HTML and display a set of minimal controls with the templates from Hypercardsimulator.com/script.js */
?>
<base href="https://hypercardsimulator.com/">
<style>
	body, html { min-height: 100%; height: 100%; }
	body { 
		margin: 0px; display: flex; flex-direction: column; 			
		user-select: none; -webkit-user-select: none; 
		-webkit-text-size-adjust: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;	
	}
	div[contenteditable], #output
		{ user-select: initial; -webkit-user-select: initial; }
	body.contextmenu 
		{ --context-menu-none: none; }
	body > #container { display: flex; margin: 0.5em; z-index: 2; xoverflow-x: auto; padding-bottom: 4px; }
	body > #container:before, body > #container:after { content: ''; flex:1; }
	body > #toolbar { }
	body > #output { flex:1; flex-basis: 200px; overflow-y: scroll; background: #F8F8F8; border-top: thin solid gray; padding: 8px; box-shadow: inset 0px 1px 2px gray; } 
	body > #output code { display: block; color: #555; tab-size: 2; font: 11px Menlo; white-space: pre-wrap; overflow-wrap: break-word; word-break: break-all;  }
</style>
<script src=script.js></script>
<body>
<div id=container>
	<modal-dialog class='static frameless loading nodrag' visible=true name="Stack" 
		style="--modal-dialog-titlebar-font: 1em Chicago;">
		<stack-part width=512 height=0><card-part class=current></card-part></stack-part>
	</modal-dialog>
</div>
<center id=toolbar>
	<button-part icon=21449 onclick="sim.card = sim.stack.firstCard;"></button-part>
	<select></select>
	<button-part icon=902 onclick="sim.card = sim.stack.prevCard;"></button-part>
	<button-part icon=26425 onclick="sim.card = sim.stack.nextCard;"></button-part>
</center>
<div id=output>
	<button-part style="float: left; margin: 0.25em 0.5em; cursor: pointer;" xfont='1em Chicago' onclick="
		var a = document.createElement('a'); 
		a.download = body.qs('stack-part').name +'.stack.html'; 
		a.href='data:text/html;charset=utf-8,'+encodeURIComponent(window.stackHTML); 
		a.click();
	" name="💾 Save" type=roundrect></button-part>
	<code></code>
</div>
<script>
	var stack = body.qs('stack-part'), json = <?php echo json_encode($stack); ?>;

	if (typeof ImportedICONImages != 'undefined')
		stack.importedICONs = JSON.stringify(ImportedICONImages);
	if (typeof ImportedWAVResources != 'undefined')
		stack.importedWAVs = JSON.stringify(ImportedWAVResources);
	if (typeof ImportedPLTEResources != 'undefined')
		stack.importedPLTEs = JSON.stringify(ImportedPLTEResources);
	if (typeof ImportedPICTResources != 'undefined')
		stack.importedPICTs = JSON.stringify(ImportedPICTResources);
	if (typeof ImportedCURSResources != 'undefined')
		stack.importedCURSs = JSON.stringify(ImportedCURSResources);
	
	stack.parentNode.name = json.name;
	stack.name = json.name;
	stack.width = json.width;
	stack.height = json.height;
	try { stack.savableJSON = json; } catch(e) { console.log(e); }

	body.qs('modal-dialog').addEventListener('closebox', ()=>{ window.location.href = window.location.href; });
	
	var noclose = 'area base br col embed hr img input link meta param source track wbr'.split(' ');
	//body.qs('#output').innerText = JSON.stringify(json);
	window.stackHTML = '<!DOCTYPE html><meta charset=UTF-8><base href="https://hypercardsimulator.com/"><script src="script.js"><\/script>\n' + emitter(json,0);
	document.qs('body > #output code').innerText = stackHTML;
	document.qs('body > #container modal-dialog').classList.remove('loading');
	
	function emitter(json, level) {
		var top = "<" + json.$ + Object.keys(json).map((a)=>{
			if (a=='$' || a=='$$') return '';
			if (json[a]=='' || /[\W]/.test(json[a])) return ' ' + a + "='" + String(json[a]).replaceAll('&','&amp;').replaceAll("'",'&apos;').replaceAll("\\","\\\\") + "'";
			return ' ' + a + '=' + json[a];
		}).join('') + ">";
		if (noclose.includes(json.$.toLowerCase()))
			return "\t".repeat(level) + top;
		var middle = (json.$$||[]).map((n)=>(typeof n==='string') ? n.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') : emitter(n,0));
		var bottom = "</"+json.$+">";
		if ((json.$$||[]).length > 2 || ((json.$$||[]).length && json.$.substr(-5)=='-part'))
			return "\t".repeat(level) + top + "\n" + middle.map((l)=>l.split('\n').map((l)=>"\t".repeat(level+1)+l).join('\n')).join('\n') + "\t".repeat(level) + "\n" + bottom;
		return "\t".repeat(level) + top + middle.join('') + bottom;
	}
	var select = body.qs('#toolbar select');
	select.innerHTML = Array.from(stack.qsa('card-part')).map((c,i)=>"<option>"+(i+1) + ' ' + c.name + "</option>").join('');
	select.selectedIndex = 0;
	select.onchange = function() { stack.card = stack.qsa('card-part')[this.selectedIndex]; }
	stack.addEventListener('openCard', function() { select.selectedIndex = Array.from(stack.qsa('card-part')).indexOf(stack.card); });

	XTalk.Send(stack.card, 'openStack', [], (proceed)=>{
		if (proceed)
			XTalk.Send(stack.card, 'openBackground', [], (proceed)=>{
				if (proceed)
					XTalk.Send(stack.card, 'openCard', [], (proceed)=>{
						stack.lockOpenCardMessages = false;
					});
				else stack.lockOpenCardMessages = false;
			});
		else stack.lockOpenCardMessages = false;
	});
</script>

<?php
}
else if (isset($target_srcname))
{
	/* we're here because of an upload */
?>
<script>
	var json=<?php echo json_encode($stack); ?>;
</script>
<script>
	if (typeof ImportedICONImages != 'undefined')
		json['importedICONs'] = JSON.stringify(ImportedICONImages);	
	if (typeof ImportedWAVResources != 'undefined')
		json['importedWAVs'] = JSON.stringify(ImportedWAVResources);
	if (typeof ImportedPLTEResources != 'undefined')
		json['importedPLTEs'] = JSON.stringify(ImportedPLTEResources);
	if (typeof ImportedPICTResources != 'undefined')
		json['importedPICTs'] = JSON.stringify(ImportedPICTResources);
	if (typeof ImportedCURSResources != 'undefined')
		json['importedCURSs'] = JSON.stringify(ImportedCURSResources);
</script>
<script>
	if (window.top.stack_uploader_json_result) {
		window.top.stack_uploader_json_result(json);
	}
	else document.write("<pre style='max-width: 100vw; overflow: auto; '>"+JSON.stringify(json, null, '\t').replaceAll('&','&amp;').replaceAll('<','&lt;')+"</pre>");
</script>
	<?php
		echo "<br>✅ Import complete. ".($found_nihongo ? "(日本語)" : "")."<br><br>";
	?>
	</div>
	
	<?php
		if (isset($_POST['whicharchive']))
		{
			$friendly_archive_name = preg_replace('/[^A-Za-z0-9\-\_]/', '-', $_POST['whicharchive']);
			output_archive_picker_form($friendly_archive_name, $filename);
			if (isset($_POST['scrollY']))
			{
				echo "<script>window.scrollTo(0,".intval($_POST['scrollY']).");</script>";
			}
		}
		else
		{
			output_form();
		}
}
else 
{
	/* no solo stack, no upload, just output  json */
	
	echo '<code style="display: block; overflow-wrap: break-word; word-break: break-all; background: white; padding: 8px; color: #555; border-top: thin solid gray;">';
	echo str_replace('&','&amp;',str_replace('<','&lt;',json_encode($stack,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_LINE_TERMINATORS)));
}
?>