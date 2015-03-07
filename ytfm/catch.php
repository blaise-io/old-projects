<?php

session_start();

error_reporting(E_ALL);


// From player
if (isset($_GET['pl']))
{
	$_SESSION['pl'] = $_GET['pl'];
	header('Location: http://www.last.fm/api/auth?api_key=ff9cf4936255f3a68d1a066bcb6fcbe4');
	echo '<a href="http://www.last.fm/api/auth?api_key=ff9cf4936255f3a68d1a066bcb6fcbe4">go here</a>';
	exit;
}

// Refresh session
if (isset($_REQUEST['refreshsession']))
{
	if ($_SESSION['user'] && $_SESSION['sk'])
	{
		$lfmses = new LfmSession;
		echo $lfmses->handshake();
	} else
	{
		echo 'NOLOCALSESSION' . "\n";
	}
}

// From Last.fm
else if (!empty($_GET['token']))
{
	$lfmses = new LfmSession;
	$lfmses->create($_GET['token']);
	header('Location: ./#' . str_replace(array(':', "\r", "\n"), '', @$_SESSION['pl']));
	echo '<a href="./#' . str_replace(array(':', "\r", "\n"), '', @$_SESSION['pl']) . '">go here</a>';
}

// Invalid
else {
	header('Location: ./');
	echo '<a href="./">go here</a>';
	exit;
}




class LfmSession
{
	var $host 		= 'http://ws.audioscrobbler.com/2.0/';
	var $host_alt	= 'http://post.audioscrobbler.com/';
	var $api_key	= 'ff9cf4936255f3a68d1a066bcb6fcbe4';
	var $secret		= '790994085afabab311b0a761154c6a8a';
	var $p			= '1.2.1';
	var $c			= 'tst';
	var $v			= '1.0';

	public function create($token)
	{
		$this->fetchSession($token);
		$this->handShake();
	}

	function fetchSession($token)
	{
		$param['api_key']	= $this->api_key;
		$param['method']	= 'auth.getsession';
		$param['token']		= $token;
		$param				= $this->_signCall($param);

		$lfmses_url	= $this->host . '?' . http_build_query($param);
		$lfmses_raw	= get_url($lfmses_url, 0);
		$lfmses_xml	= parse_xml($lfmses_raw);

		logData('Get auth session: ' . $lfmses_raw);

		if (!empty($lfmses_xml->session->key))
		{
			$_SESSION['user']	= (string) $lfmses_xml->session->name;
			$_SESSION['sk']		= (string) $lfmses_xml->session->key;
			$_SESSION['time']	= time();
			return true;
		}
	}

	function handShake()
	{
		$param['hs']		= 'true';
		$param['p']			= $this->p;
		$param['c']			= $this->c;
		$param['v']			= $this->v;
		$param['u']			= $_SESSION['user'];
		$param['t']			= time();
		$param['a']			= md5($this->secret . $param['t']);
		$param['api_key']	= $this->api_key;
		$param['sk']		= $_SESSION['sk'];

		$lfmhs_url	= $this->host_alt . '?' . http_build_query($param);
		$lfmhs_res	= get_url($lfmhs_url, 0);
		$lfmhs_raw	= explode("\n", $lfmhs_res);

		logData('Handshake: ' . $lfmhs_res);

		if (trim($lfmhs_raw[0]) == 'OK')
		{
			$_SESSION['s']		= trim($lfmhs_raw[1]);
			$_SESSION['np_url']	= trim($lfmhs_raw[2]);
			$_SESSION['sm_url']	= trim($lfmhs_raw[3]);
		}
		return $lfmhs_res;
	}

	private function _signCall($param)
	{
		ksort($param);
		$signature = '';
		foreach ($param as $key => $value)
		{
			$signature .= $key . $value;
		}
		$param['api_sig'] = md5($signature . $this->secret);
		return $param;
	}
}

function get_url($url, $max_cache_time = 2592000)
{
	$cache_file = './cache/' . md5($url) . '.xml';
	if (!file_exists($cache_file) || filemtime($cache_file) > time() + $max_cache_time)
	{
		$ch = curl_init($url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HTTP_VERSION, 'CURL_HTTP_VERSION_1_1');

		$data = curl_exec($ch);

		curl_close($ch);

		if ($max_cache_time > 0)
		{
			file_put_contents($cache_file, $data);
		} else
		{
			return $data;
		}
	}
	return file_get_contents($cache_file);
}

function parse_xml($xml)
{
	try
	{
		return new SimpleXMLElement($xml);
	}
	catch (Exception $e)
	{
		die('Invalid XML:<pre>' . htmlspecialchars($xml));
	}
}

function logData($msg)
{
	$logfile = 'log.txt';
	$log = file_get_contents($logfile);
	$log = date('r') . "\t" . $msg . PHP_EOL . '=========================' . PHP_EOL . $log;
	file_put_contents($logfile, $log);
}

?>