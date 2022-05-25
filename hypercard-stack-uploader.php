<?php

/*
	
	LICENSE:
	This file was developed ©2022 Hypervariety Custom Software, LLC. There is no warranty of any kind expressed or implied.
	THIS FILE IS OPEN SOURCE. YOU CAN COPY AND RUN THIS FILE YOURSELF AND LEARN PROGRAMMING TECHNIQUES FROM IT.
	Although the code is not very well-written or pretty, in the interests of public discourse, I am making it available for view. 
	
	THANK YOU TO THE RETRO-HACKERS WHO FIGURED OUT THE HC STACK FORMAT.
	https://hypercard.org/hypercard_file_format_pierre/
	https://github.com/PierreLorenzi/HyperCardPreview/blob/master/StackFormat.md
	
	This php script shows a form that lets the user upload HyperCard 1.x or 2.x stacks. 
	If installed, it uses Maconv to get it out of a StuffIt archive, .dsk, or .img file.
	It translates the stack to a big JSON with mostly proper HC property names. 
	Then at the end, depending on the flag it either shows the JSON, sends it to the parent window, or puts the stack up on display.
	
*/
	
$show_errors = true;
ini_set('display_errors', $show_errors ? 1 : 0);
error_reporting($show_errors ? -1 : 0); 	// this is really hard core, in PHP 8 it's the default

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
echo "<!DOCTYPE html><meta charset=utf-8><meta name=viewport content='width=device-width, height=device-height, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover'>\n";

/* path to move uploaded file */
$SAFE_STACK_CONVERTER_UPLOADS_DIR = "stack-uploads/";

/* path to Maconv if you want to open .sit, .dsk, etc */
$MACONV_INSTALLATION_LOCATION = null;

/* set to true if you want to show the stack by linking in the xtalk templates from hypercardsimulator.com */
$SHOW_PACKAGED_SOLO_STACK = false;

@include("file-system-aux.php");

/* set these to something for testing. otherwise the upload form will take care of it. */
$filename = "";
$contents = "";
$possible_resource_fork = "";
$i = 0;

//	echo "<pre>".shell_exec($MACONV_INSTALLATION_LOCATION."maconv e -h " )."</pre>\n";
/*echo "<pre>"
	.shell_exec($MACONV_INSTALLATION_LOCATION."maconv e "
		.escapeshellarg($SAFE_STACK_CONVERTER_UPLOADS_DIR."foul_airs.dsk")." "
		.escapeshellarg($SAFE_STACK_CONVERTER_UPLOADS_DIR."maconv-results/"."foul_airs.dsk")
	)."</pre>\n";*/
/*echo shell_exec($MACONV_INSTALLATION_LOCATION."maconv".' -v e stack-uploads/PianoKeys.img '.'SUPKI')."\n";
echo "<center><h3>".$target_file." ".$target_file_extension."....</h3></center>";*/
//echo "The file ". htmlspecialchars( basename( $_FILES["fileToUpload"]["name"])). " has been uploaded.";

if (isset($_POST['whichimport']))
{
	$maconv_output_folder = $SAFE_STACK_CONVERTER_UPLOADS_DIR."maconv-results/";
	
	$target_srcname = str_replace("..","",$_POST['whichimport']);	// need to strip any dotty business
	$filename = $maconv_output_folder.$target_srcname;
	$possible_resource_fork = $maconv_output_folder.$target_srcname.'.rsrc';
}

if (!$filename && isset($_POST['convert']))
{
	$target_dir = $SAFE_STACK_CONVERTER_UPLOADS_DIR;
	@mkdir($target_dir);
	$uploadname = basename($_FILES["fileToUpload"]["name"]);
	$target_srcname = $uploadname;
	$target_file = $target_dir . $target_srcname;
	$target_file_extension = pathinfo($target_file,PATHINFO_EXTENSION);
	
	// Check file size
	if ($_FILES["fileToUpload"]["size"] > 10000000) 
		echo "<center><h3><font color=red>Sorry, “Mr IIfx”, that file is too large.</font></h3></center>";
	else if (!move_uploaded_file($_FILES["fileToUpload"]["tmp_name"], $target_file)) 
		echo "<center><h3><font color=red>Sorry, there was an error uploading your file.</font></h3></center>";
	else if (empty(testforstackness($target_file)))
	{
		// it's a stack file, continue
	}
	else if (!empty($MACONV_INSTALLATION_LOCATION) /*&& ($target_file_extension == 'img' || $target_file_extension == 'dsk' || $target_file_extension == 'sit' 
		|| file_get_contents($target_file, NULL, NULL, 4, 4) == 'SIT!')*/)
	{
		// try to unstuff with the beautiful Maconv software
		//	echo "<center><h3>Maconv decompressing....</h3></center>";
		//	echo "<pre>".shell_exec($MACONV_INSTALLATION_LOCATION."maconv --help")."\n</pre>";
		$friendly_archive_name = preg_replace('/[^A-Za-z0-9\-\_]/', '-', $target_srcname);
		$maconv_output_folder = $target_dir."maconv-results/".$friendly_archive_name;
		echo "<pre style='display:none;'>\n";
		echo shell_exec("rm -rf " . escapeshellarg($maconv_output_folder));
		echo shell_exec($MACONV_INSTALLATION_LOCATION."maconv e ".escapeshellarg($target_file)." ".escapeshellarg($maconv_output_folder));
	//	echo "<pre>".shell_exec($MACONV_INSTALLATION_LOCATION."maconv -v e ".escapeshellarg($target_file).' '.escapeshellarg($maconv_output_folder))."\n</pre>";
		//$firstlevel = explode("\n", shell_exec('ls '.escapeshellarg($maconv_output_folder)));
		//print_r($firstlevel);

		function rglob($pattern, $flags = 0) {
			$files = glob($pattern, $flags); 
			foreach (glob(dirname($pattern).'/*', GLOB_ONLYDIR|GLOB_NOSORT) as $dir) {
				$files = array_merge($files, rglob($dir.'/'.basename($pattern), $flags));
			}
			return $files;
		}
		
		$firstlevel = Array();
		$cwd = getcwd();
		if (chdir($maconv_output_folder))
		{
			$firstlevel = (rglob('*'));	// try this instead
			chdir($cwd);
			print_r($firstlevel);
		}
		
		echo "</pre>\n";

		$firstlevel = array_reverse($firstlevel);
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
				array_push($candidates, $target_file);

				$target_srcname = $target_file;
				$possible_resource_fork = $maconv_output_folder.'/'.$target_file.'.rsrc';
				//break;
			}
		}
		
		if (empty($target_srcname))
		{
			echo "<center><h3><font color=red>Could not locate a HyperCard stack file in archive.</font></h3></center>";
		}
		else if (count($candidates) > 1)
		{
			$filename = "";

			echo "<form method=post>";
			echo /*"‘".htmlspecialchars($uploadname)."’"*/ "Archive contains ".count($candidates)." stacks, select one to import:<br>";
			$first=true;
			foreach ($candidates as $c)
			{
				echo "<label><input type=radio name=whichimport value=\"".htmlspecialchars($friendly_archive_name."/".$c)."\" ".($first ? "checked=true" : "")."> ".$c." (".(round(filesize($maconv_output_folder.'/'.$c)/1000))."K)</label><br>";
				$first = false;
			}
			echo "<input type=submit value=Import></form>";
			return;
		}
	}
	else
	{
		$error = testforstackness($target_file);
		if (!empty($error))
			echo $error;
	}
}

function testforstackness($target_file)
{
	global $filename;
	
	if (file_get_contents($target_file, NULL, NULL, 4, 4) != 'STAK')	// i've seen this create a 'is a directory' error with Get Rich Quick . sit
	{
		return "<center><h3><font color=red>That doesn't seem to be a stack file.</font></h3></center>";
	}
	/*else if (unpack("N1", file_get_contents($target_file, NULL, NULL, 16, 4), 0)[1] < 9)
	{
		return "<center><h3><font color=red>That seems to be a HC v1.x stack.</font></h3></center>";
	}*/
	
	$filename = $target_file;
	return "";
}

//$possible_resource_fork = "Piano Keys v 2.1.rsrc";
//$possible_resource_fork = "Pantechnicon.rsrc";
// start by reading in the resources so they're ready to go
if ($possible_resource_fork && file_exists($possible_resource_fork) && ($contents=file_get_contents($possible_resource_fork)))
{
	//echo "Here goes the resource fork read";
	/*echo substr($contents, 1048 + 30, 4);
	echo strlen($contents);
	echo "\nScanning ".$possible_resource_fork." (".strlen($contents)."b)\n";*/
	// resource map
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
				'ID'=>two($reflistoffset),
				'name'=>($nameoffset==0xFFFF)?''	// macroman?
					:macroman(substr($contents, $map + $i_of_namelist + $nameoffset + 1, one($map + $i_of_namelist + $nameoffset))),
				//'length'=>four($data + $dataoffset),
				'data'=>base64_encode(substr($contents, $data + $dataoffset + 4, four($data + $dataoffset)))
			);
		}
		
		$types[$type] = $resources;
		//$types[] = $type;
	}
	if (isset($types['ICON']))
	{
		
	// this works but we need to attach it to the stack itself so it can be saved
?>
<script>
	var convertedicons = <?php echo json_encode($types['ICON']); ?>;
	var workcanvas = document.createElement('canvas');
	workcanvas.width = workcanvas.height = 32;
	var ctx = workcanvas.getContext('2d');
	var ImportedICONImages = {};
	convertedicons.forEach((icon)=>{
		var imgData = ctx.createImageData(32,32), bitmap = atob(icon.data);
		for (var i = 0; i < imgData.data.length; i += 4) 
		{
			var bit = bitmap.charCodeAt(Math.floor(i/32)) & (0x80>>((i/4)%8));
			imgData.data[i+0] = bit ? 0 : 255;
			imgData.data[i+1] = bit ? 0 : 255;
			imgData.data[i+2] = bit ? 0 : 255;
			imgData.data[i+3] = 255;
		}
		//console.log(imgData.data);
		ctx.putImageData(imgData,0,0);
		ImportedICONImages[icon.ID] = workcanvas.toDataURL();
		//if (!ImportedICONImages[icon.name]) 
		//	ImportedICONImages[icon.name] = icon.ID;
		if (icon.name) ImportedICONImages[icon.name] = workcanvas.toDataURL();	// shrug
	});
</script>
<?php
	}
	//print_r($types);	
	//return;
}
	

if (!$filename)
{
	output_form();
	return;
}
	
function output_form()
{
?>

<center>
<script>
	function inspectInput(form)
	{
		var size = form.fileToUpload.files[0].size;
		if (size > 10000000) { output.innerText = 'File too large. 10M max please.'; return false; } 
		output.innerText = 'Selected ' + Math.round(size/1000) + 'K file.';
		return true;
	}
</script>
<form method="post" enctype="multipart/form-data" onsubmit="
	if (!inspectInput(this)) { event.preventDefault(); return false; } 
	output.innerText += '\nNow uploading file. Please be patient...';
	console.log('Submitting form...'); 
	return true;">
	<h3>HyperCard Stack Importer</h3>
	Select stack to upload (<code>.sit</code>, <code>.dsk</code>, <code>.img</code> or raw file):<br><br>
	<input type="file" name="fileToUpload" id="fileToUpload" oninput="
		if (document.readyState!='complete' || !inspectInput(this.form)) return;
		if (this.form.onsubmit())
			this.form.submit();
		" style="padding: 10px 0px;">
	<input type="hidden" value="convert" name="convert" id="convert">
	<input type="submit" value="Upload" name="dosubmit" id="dosubmit">
</form>
</center>

<div id=output>
</div>

<?php
}

/* begin the stack read. A stack is a chain of simple blocks called STAK, CARD, etc. */

$contents = file_get_contents($filename);
$i = 0;
$hc1 = (four(16) < 9);

if (!$SHOW_PACKAGED_SOLO_STACK && $contents !== false)
{
	echo "Upload successful.<br>Now importing stack. Please be patient...<br>";
	flush();
}

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
function macroman($out)
{
	return iconv('macintosh', 'UTF-8', $out);
}
function dho($c) { return dechex(ord($c)); }
function decodeanddivify($str) { 
	
	return Array('$'=>'div','$$'=>[macroman($str),Array('$'=>'br')]); 
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

function read_CARDorBKGD_block($i, $size, $isBKGD)
{
	global $contents;
	global $blocks;
	global $fonts;
	global $styles;
	global $hc1;
	
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
			'location'=>[two($i+8,true),two($i+6,true)],
			'width'=>two($i+12)-two($i+8),
			'height'=>two($i+10)-two($i+6)
		);
		$flags = one($i+5);
		//$part['flagsA'] = $flags;
		if ($flags&(1<<7)) $part['visible'] = false;
		if ($flags&(1<<5)) $part['dontWrap'] = true;
		if ($flags&(1<<4)) $part['dontSearch'] = true;
		if (($flags&(1<<3)) && !$button) $part['sharedText'] = true;
		if (!($flags&(1<<2)) && !$button) $part['fixedLineHeight'] = true;
		if ($flags&(1<<1)) $part['autoTab'] = true;
		if ($flags&(1<<0) && $button) $part['enabled'] = false;
		if ($flags&(1<<0) && !$button) $part['lockText'] = true;
		$flags = one($i+14);
		//$part['flagsB'] = $flags;
		if (!($flags&(1<<7)) && $button) $part['showName'] = false;
		if ($flags&(1<<7) && !$button) $part['autoSelect'] = true;
		if ($flags&(1<<6) && $button) $part['hilite'] = true;
		if ($flags&(1<<6) && !$button) $part['showLines'] = true;
		if (!($flags&(1<<5)) && $button) $part['autoHilite'] = false;
		if ($flags&(1<<5) && !$button) $part['wideMargins'] = true;
		if ($flags&(1<<4) && $button && $isBKGD) $part['sharedHilite'] = false;
		if ($flags&(1<<4) && !$button) $part['multipleLines'] = true;
		if ($flags&15 && $button) $part['family'] = ($flags&15);

		if ($button && two($i+18) && $parttype==11)
			$part['selectedLine'] = two($i+18);
		else if ($button && two($i+18))
			$part['icon'] = two($i+18); 
		
		/*if ($parttype == 5 || $parttype == 6) {}	// don't transmit align, it does nothing
		else */if (two($i+20)==1) $part['textAlign'] = 'center'; 
		else if (two($i+20)==0xFFFF) $part['textAlign'] = 'right';

		if (isset($fonts[two($i+22)])) {
			//$part['font'] = two($i+24)."px ".$fonts[two($i+22)];
			$part['textFont'] = $fonts[two($i+22)];
			$part['textSize'] = two($i+24);
		}
		else {	// HC1? let's see
			$part['textFont'] = Array(0=>'Chicago',2=>'New York',3=>'Geneva',4=>'Monaco',16=>'Palatino',20=>'Times',21=>'Helvetica',22=>'Courier',23=>'Symbol')[two($i+22)] ?? two($i+22);
			$part['textSize'] = two($i+24);
		}
		
		$flags = one($i+26);
		$ecso = styleclass($flags);
		if ($ecso) {
			$part['class'] = $ecso;
			$part['textStyle'] = str_replace(' ', ',', $ecso);	// HC likes comma lists or 'plain', plain will be default
		}
		
		$part['lineHeight'] = two($i+28);
		
		$scr = nullstr($i+30+strlen($pn)+1+1);
		if (strlen($scr))
			$part['script'] = macroman($scr);
	
		array_push($parts, $part);
		$i += two($i);
	}
	
	if ($i != $partstop) echo "hey different! $i $partstop \n";
	//echo "contentscount ".$contentscount." size ".$cls." at ".$i."\n";
	
	$stop = ($i+$cls);
	for ($c = 1; $c <= $contentscount; $c++)
	{
		$cid = two($i,true);		// HC stores positive ID for bg fld, negative for cd fld
		if (!$isBKGD)
			$cid = -$cid;	// now it's correct ID for layer, and for the other layer if it's negative
		
		if ($cid < 0)	// bg field text on card, which we store with negative numbers this way
			$part = Array('$'=>'div', 'slot'=>$cid, 'ID'=>$cid);	
		else 
			$part = find($parts, null, $cid);
		
		if ($hc1)
		{
			//echo "id $cid first four: ".one($i+2).one($i+3).one($i+4).one($i+5)."\n";
			$partcontents = nullstr($i+2);
			//echo strlen($partcontents).": ".macroman($partcontents)."DONE\n";
			
			$part['$$'] = array_map('decodeanddivify', explode("\n",$partcontents));
			if ($part)
				find($parts, null, $cid, $part);

			$i += 2 + strlen($partcontents) + 1;
			continue;
		}

		$csize = (two($i+2)+4);
		
		//if ($i > $stop) { echo "past the contents count\n"; exit(); }
		//echo "contents size ".$csize." cid ".$cid." one($i+4) ".one($i+4)."\n";
		
		if (!$part) {
			//echo "isBKGD ".$isBKGD." id ".$ID." unknown cid ".$cid."<br>"; 	// seems to be possible in uncompressed stack to have obselete bg fld data 
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
		
	//echo "mask ".strlen($mask)."B ".join(',',array_map('dho', str_split($mask)))."\n";
	//echo "image ".strlen($image)."B ".join(',',array_map('dho', str_split($image)))."\n";

	array_push($a, base64_encode($mask), base64_encode($image));
	return $a;
}
	
function find(&$array, $type, $ID=0, $replace=null) {
	foreach ($array as $key=>$p) {
		if ((!$ID || $p['ID']==$ID) && (!$type || $p['type']==$type)) {
			if ($replace) $array[$key] = ($p=$replace);
			return $p;
		}
	}
	if ($replace) array_push($array, $replace);
	return $replace;
}

$i = 0;
$blocks = Array();

while ($i < strlen($contents))
{
	$size = four($i)&0x0FFFFFF;
	array_push($blocks, Array('type'=>($type=fourstr($i+4)),'ID'=>four($i+8),'size'=>$size,'i'=>$i));
	$i += $size;
	if ($type=='TAIL') 
		break;
}

$stack = Array('$'=>'stack-part','name'=>macroman(basename($target_srcname??$filename)));

$STAK = find($blocks, 'STAK');
$i = $STAK['i'];
$stack['width'] = two($i+76+2+18+16+328+2);
if ($stack['width']==0) $stack['width'] = 512;
$stack['height'] = two($i+76+2+18+16+328+0) ?? 342;
if ($stack['height']==0) $stack['height'] = 342;

$stack['buttonCSSFont'] = "12px Chicago";
$stack['fieldCSSFont'] = "12px Geneva";

$scr = nullstr($i+76+2+18+16+328+2+262+320+512);
if (strlen($scr))
	$stack['script'] = macroman($scr);
//print_r($stack);

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
$STBL = find($blocks, 'STBL');
if ($STBL)
{
	$STBL_count = four($STBL['i']+16);
	$i = $STBL['i'] + 24;
	for ($f = 0; $f < $STBL_count; $f++)
	{
		if (isset($fonts[two($i+12)]))
		{
			$style = Array();
			if (two($i+12) != 0xFFFF) $style['font'] = $fonts[two($i+12)];
			if (two($i+14) != 0xFFFF) $style['flags'] = styleclass(one($i+14));
			if (two($i+16) != 0xFFFF) $style['size'] = two($i+16);
			$styles[four($i)] = $style;
		}
	
		$i += 24;
	}
	//print_r($styles);	// [3]=>Geneva etc
}
	
$bkgnds = Array();
foreach ($blocks as $block)
{
	if ($block['type'] != 'BKGD') 
		continue;
	array_push($bkgnds, read_CARDorBKGD_block($block['i'], $block['size'], true));
}
//print_r($bkgnds);
//exit();

$cards = Array();
	
$LIST = find($blocks, 'LIST');
$i = $LIST['i'];
if ($hc1) $i -= 4;	// HC1 format is shifted 4 bytes.
$pagecount = four($i+16);
$entrysize = two($i+28);
if ($hc1) $i += 4;	// but the list is in the same place

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
					$CARD = find($blocks,'CARD',$id);
					array_push($cards, read_CARDorBKGD_block($CARD['i'], $CARD['size'], false));
				}
			$i = $nextentry;
		} while ($i < $block['i'] + $block['size']);
		
		break;
	}
	
	$i = $oldPageI;
}
	
$stack['$$'] = array_merge($bkgnds, $cards);

if ($SHOW_PACKAGED_SOLO_STACK)
{
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
	<modal-dialog class='static frameless closebox loading nodrag' visible=true name="Stack" 
		style="--modal-dialog-titlebar-font: 1em Chicago;">
		<stack-part width=512 height=0><card-part class=current></card-part></stack-part>
	</modal-dialog>
</div>
<center id=toolbar>
	<button-part icon=21449 onclick="wildcard.card = wildcard.stack.firstCard;"></button-part>
	<select></select>
	<button-part icon=902 onclick="wildcard.card = wildcard.stack.prevCard;"></button-part>
	<button-part icon=26425 onclick="wildcard.card = wildcard.stack.nextCard;"></button-part>
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
	
	stack.parentNode.name = json.name;
	stack.name = json.name;
	stack.width = json.width;
	stack.height = json.height;
	try { stack.savableJSON = json; } catch(e) { console.log(e); }
	/*stripwoba(json);
	function stripwoba(node) {
		if (node.WOBA) delete node.WOBA;
		(node.$$||[]).forEach(stripwoba);
	}*/
	body.qs('modal-dialog').addEventListener('closebox', ()=>{ window.location.href = window.location.href; });
	
	var noclose = 'area base br col embed hr img input link meta param source track wbr'.split(' ');
	//body.qs('#output').innerText = JSON.stringify(json);
	window.stackHTML = '<!DOCTYPE html><meta charset=UTF-8><base href="https://hypercardsimulator.com/"><script src="script.js"><\/script>\n' + emitter(json,0);
	document.qs('body > #output code').innerText = stackHTML;
	document.qs('body > #container modal-dialog').classList.remove('loading');
	
	function emitter(json, level) {
		var top = "<" + json.$ + Object.keys(json).map((a)=>{
			if (a=='$' || a=='$$') return '';
			//if (json[a]=='' || /[\W]/.test(json[a])) return ' ' + a + '="' + String(json[a]).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("\\","\\\\") + '"';
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
</script>

<?php
}
else if (isset($target_srcname))
{
	/* we're here because of an upload */
?>
<script>
	var json=<?php echo json_encode($stack); ?>;
	if (typeof ImportedICONImages != 'undefined')
		json['importedICONs'] = JSON.stringify(ImportedICONImages);	// we'll want a 'resource fork' for stacks sometime, probably
	if (window.top.stack_uploader_json_result) window.top.stack_uploader_json_result(json);
	else document.write(JSON.stringify(json));
</script>
	<?php
}
else {
	/* no solo stack, no upload, just output  json */
	
	echo '<code style="display: block; overflow-wrap: break-word; word-break: break-all; background: white; padding: 8px; color: #555; border-top: thin solid gray;">';
	echo str_replace('&','&amp;',str_replace('<','&lt;',json_encode($stack,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_LINE_TERMINATORS)));
}
?>