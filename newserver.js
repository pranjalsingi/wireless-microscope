var exec = 	require('child_process').exec;
var http = 	require("http");
var express = 	require('express');
var bodyParser = require('body-parser')
var path = 	require('path');
var mime = 	require('mime');
var fs = 	require('fs');
var fs1 = 	require('fs');
var socketio = require('socket.io');
var SerialPort = require("serialport");

var app = express();
var server = http.createServer(app);
var io = socketio.listen(server);
flag = false;
var serialPort;
var portName = '/dev/ttyACM0';
var dirn = 'thumbnail';
var cameraNo = '16401446';


app.use(bodyParser.urlencoded({extended: true})); app.use(bodyParser.json()); 
app.use(express.static(__dirname));

io.on('connection', function (socket) {
	liveVideo = function(){
		flag = true
		exec('bin/BinnedImageEx', function(err, stdo, stde){
			if(err != null){
				console.log("Error is " + err);
				return false
			}
		});
		return true
	}

	stopLiveVideo = function(){
		flag = false
		exec('pkill BinnedImageEx', function(err, stdo, stde){
			if(err != null){
				console.log('Error is: '+err);
				return false
			}
		});
		return true
	}

	app.post('/api/capture', function(req, res){
		console.log('got here');
		exec('pkill BinnedImageEx', function(err, stdo, stde){
			if(err != null){
				console.log('Execution error')
			}
			else
			{
				exec('bin/VideoImageEx', function(err, stdo, stde){
					if(err != null){
						console.log('Image didn\'t generated' +err)
					}
					else {
						var d = Date.now()
						fs1.renameSync('images/'+cameraNo+'-0.tiff', 'images/'+d+'.tiff')
						exec('bin/BinnedImageEx', function(err, stdo, stde){});
						exec('convert -thumbnail 200 images/'+d+'.tiff thumbnail/'+d+'.png');
					}
				});
			}
		});
		res.json();
	});

	app.post('/api/liveVideo', function(req, res){
		var status = req.body.status
		if(status){
			t = liveVideo()
			console.log(t)
			//Return to client a message if t is false
			res.json();
		}
		else{
			t = stopLiveVideo()
 			/*exec('bin/VideoImageEx', function(err, stdo, stde){
                                        if(err != null){
                                                console.log('Image didn\'t generated' +err)
                                        }
                                        else {
                                                fs1.renameSync('images/16047039-0.tiff', 'timelapse/'+Date.now()+'.tiff')
                                                serialPort.write("0S");
                                                pingClient(temp);
                                        }
                                });
			console.log(t)*/
			//Return message if t is false
			//res.status(400).send({message: 'Camera didn\'t started'});
			res.json();
		}
	});

	app.post('/api/captureVideo', function(req, res){
		var interval = req.body.interval;
		var repeat = req.body.repeat;
		var secInter = interval * 60 * 1000;
		var capStatus = req.body.capStatus;
		var intensity = req.body.intensity;
		if(capStatus){
			if(flag){
				t = stopLiveVideo();
			}
			var ti = setInterval(function(){timeLapse(repeat)}, secInter);
			temp = repeat
			timeLapse = function(repeat){
				//serialPort.write(intensity + "S");
				exec('bin/VideoImageEx', function(err, stdo, stde){
					if(err != null){
						console.log('Image didn\'t generated' +err)
					}
					else {
						fs1.renameSync('images/'+cameraNo+'-0.tiff', 'timelapse/'+Date.now()+'.tiff')
						//serialPort.write("0S");
						temp--;
						pingClient(temp);
						if(temp == 0){
                                       			clearInterval(ti);
                                			pingClient("over");
                                		}

                                		console.log("hello "+temp);
					}
				});

				/*if(temp == 0){
					clearInterval(ti);
					pingClient("over");
				}

				console.log("hello "+temp);
				temp--;*/
			}
		}
		else{
			clearInterval(ti);
		}
		res.json();
	});

	app.get('/api/getImages', function(req, res){
		fs.readdir(dirn, function(err, filenames){
			if (err){
				//Reply back with some error
			}
			/*filenames.forEach(function(filename){
				fs.readFile(dirn+'/'+filename, 'base64', function(err, buff){
					sendImage(buff);
				});
			});*/
			res.json(filenames);
		})

	});

	app.get('/api/downloadImages', function(req, res){
		console.log("Request to download images");
		exec('zip -r images.zip images/', function(err, stdo, stde){
                                        if(err != null){
                                                console.log('Images Zip didn\'t generated' +err)
                                                res.status(404).end();
                                        }
                                        else {
                                                var d = new Date();
                                                var name = 'images_'+d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate()+'_'+d.getHours()+'-'+d.getMinutes()+'.zip';
                                                res.download(__dirname + '/images.zip', name);
                                        }
        			});
	});

	app.get('/api/downloadTimeLapse', function(req, res){
		console.log("Request to download time lapse");
                exec('zip -r timelapse.zip timelapse/', function(err, stdo, stde){
                                        if(err != null){
                                                console.log('Timelapse Zip didn\'t generated' +err)
                                                res.status(404).end();
                                        }
                                        else {
						var d = new Date();
						var name = 'timelapse_'+d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate()+'_'+d.getHours()+'-'+d.getMinutes()+'.zip';
						res.download(__dirname + '/timelapse.zip', name);
                                        }
                                });

        });


	var previousImage = '';
	var imageName = '';

	// Watching the directory bin for changes of file
	fs.watch('generate/', function(event, filename){
		// When the file changes, it will run the if condition
    		if (filename != imageName){
      			// Change the imageName to filename and emit with help of socket
      			previousImage = imageName;
      			imageName = filename;
      			uploadImage();
		};
	});

  	var uploadImage = function(){
		fs.readFile('generate/'+previousImage, 'base64', function(err, buf){
			socket.emit('image upload', { image: true, buffer: buf });
		});
  	};

	var sendImage = function(buff){
		//console.log(buff);
		//socket.emit('sending image', {image: true, buff: buff});
	};

	socket.emit('welcome', { hello: 'world' });

	pingClient = function(temp){
		console.log("is this coming here "+temp)
		socket.emit('timelapse', { temp : temp });
	}

  	socket.on('ping server', function (data) {
    		var now = new Date();
    		socket.emit('pong server', {temp : '0'});
  	});

	socket.on('focus-move', function (data) {
                serialPort.write(data.value);
		console.log("moving "+data.value);
        });

	socket.on('focus-stop', function (data) {
                serialPort.write(data.value);
		console.log("stping "+data.value);
        });

	socket.on('slider-value', function(data){
		console.log("slider "+data.value);
		serialPort.write(data.value+'S');
	});

	socket.on('led', function(data){
		console.log(data);
		serialPort.write(data.value);
	});

	socket.on('motor', function(data){
		console.log("Motor "+data);
        	serialPort.write(data.value);
        });

	socket.on('imaging', function(data){
		console.log('Data coming from imaging : '+data.value);
		serialPort.write(data.value);
	})

});

//this is where we actually turn to the outside world.  You'll need //to adjust if you are on some other server. 
server.listen(process.env.PORT || 80, process.env.IP || "127.0.0.1", function(){
  	var addr = server.address();
  	console.log("Magic happens at", addr.address + ":" + addr.port);

	// Initialize serialPort
	/*serialPort = new SerialPort(portName, {
		baudrate : 9600,
		dataBits : 8,
		stopBits : 1,
		flowControl : false
	});*/
});