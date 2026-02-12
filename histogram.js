
function Histogram(source, element, updateInterval) {

	this.maxHistogramSampleDimension = 128; //if image is bigger than this, scale down before generating the histogram
	this.attemptsLeft = 4; //try this many times to generate a histogram and then give up

	this.histogram = [];
	this.lastHistogram = [];
	this.src = source;
	this.element = element;
	this.updateInterval = updateInterval;
	this.animated = this.element && this.updateInterval > 0;
	this.success = false;
	this.ready = false;
	this.onload = null;
	this.onerror = null;
	this.onupdate = null;
	this.timer = null;
	this.totalPixels = 0;
	this.status = 'About to start';
	this.id = Histogram.nextID++;

	if (this.animated)
	{
		this.status = 'Waiting for video';
		this.drawObject = element;
		window.setTimeout(this.loaded.bind(this), 100);
	}
	else
	{
		this.status = 'Loading Image';
		this.drawObject = new Image();
		var that = this;
		this.drawObject.crossOrigin = "Anonymous";
		this.drawObject.onload = this.loaded.bind(this);
		this.drawObject.onerror = this.loadError.bind(this);
		this.drawObject.src = this.src;
	}

	console.log("Histogram for " + this.src + ", " + (this.animated ? "animated" : "still"));
}
Histogram.nextID = 0;


Histogram.prototype.createGraph = function() {
	var canvas = document.createElement("canvas");
	canvas.context = canvas.getContext("2d");
	var w = canvas.width = 128;
	var h = canvas.height = 128;
	var ctx = canvas.context;

	ctx.fillStyle="rgba(0,0,0,0.5)";
	ctx.fillRect(0, 0, w, h);
	ctx.lineWidth = 1;

	var stroke = ['rgba(255,0,0,1)', 'rgba(0,255,0,1)', 'rgba(0,0,255,1)', 'rgba(255,255,255,1)'];
	var fill = ['rgba(255,0,0,1)', 'rgba(0,255,0,0.5)', 'rgba(0,0,255,0.25)', 'rgba(220,220,220,0.125)'];

	for (var f = 0; f < 2; ++f)
	{
		for (var c = 0; c < 4; ++c)
		{
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (var i = 0; i < 255; ++i)
				ctx.lineTo((i/254)*256, h - h * this.histogram[c*256+i]);
			ctx.lineTo(256, h);
			ctx.closePath();
			ctx.strokeStyle = stroke[c];
			ctx.fillStyle = fill[c];
			if (f == 0)
				ctx.fill();
			else
				ctx.stroke();
		}
	}

	return canvas;
}

Histogram.prototype.histoSkip = function(a, n) {
	var l = [];
	for (var i = 0; i < a.length; i += n)
		l.push(Math.round(a[i]*1000)/1000);
	return l;
};

Histogram.prototype.getData = function(channel, last, blockSize) {
	if (last)
		return this.histoSkip(this.lastHistogram.slice(256*channel, 256*(1+channel)), blockSize).join(" ");
	else
		return this.histoSkip(this.histogram.slice(256*channel, 256*(1+channel)), blockSize).join(" ");
};

Histogram.prototype.stop = function() {
	window.clearInterval(this.timer);
};

Histogram.prototype.getImagePixels = function(drawable) {
	if (typeof Histogram.prototype.getImagePixels.tempCanvas == 'undefined') {
		Histogram.prototype.getImagePixels.tempCanvas = null;
	}

	try {
		if (!Histogram.prototype.getImagePixels.tempCanvas)
			Histogram.prototype.getImagePixels.tempCanvas = document.createElement("canvas");

		var w = drawable.naturalWidth || drawable.clientWidth;
		var h = drawable.naturalHeight || drawable.clientHeight;

		if (w == 0 || h == 0)
		{
			this.status = "Error: image has zero width/height";
			return false;
		}

		var scale = 1.0 / Math.max(Math.max(
			w / this.maxHistogramSampleDimension,
			h / this.maxHistogramSampleDimension
			), 1.0);
		Histogram.prototype.getImagePixels.tempCanvas.width = w * scale;
		Histogram.prototype.getImagePixels.tempCanvas.height = h * scale;

		var canvasContext = Histogram.prototype.getImagePixels.tempCanvas.getContext("2d", {willReadFrequently: true});
		canvasContext.drawImage(drawable, 0, 0, w, h, 0, 0, Histogram.prototype.getImagePixels.tempCanvas.width, Histogram.prototype.getImagePixels.tempCanvas.height);
		var pixels = canvasContext.getImageData(0, 0, canvasContext.canvas.width, canvasContext.canvas.height);
		return pixels;
	}
	catch (e) {
		this.status = e;
		Histogram.prototype.getImagePixels.tempCanvas = null; //canvas is tainted. can't use it any more
		console.log(e);
		return null;
	}
};

Histogram.prototype.updateHistogram = function(drawable) {
	var pixels = this.getImagePixels(drawable);
	if (!pixels)
		return false;

	this.totalPixels = pixels.width * pixels.height;
	if (this.totalPixels == 0)
		return false;

	var data = pixels.data;

	this.lastHistogram = this.histogram;
	this.histogram = [];

	//initialize arrays
	var channels = 4;
	var h = [];
	var i, c;
	for (i = 0; i < 256 * channels; ++i)
		h[i] = 0;

	//compute histogram h
	var n = pixels.width * pixels.height;
	var scale = 1.0 / n;
	var total = [0, 0, 0];
	for (i = 0; i < n; ++i)
	{
		//channel 0, 1, 2 = rgb
		for (c = 0; c < 3; ++c)
			h[data[i*4+c]*channels+c] += scale;

		//channel 3 = luminance
		var y = 0.299 * data[i*4+0] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
		h[Math.floor(y)*channels+3] += scale;
	}

	//integrate h into this.histogram
	for (c = 0; c < channels; ++c)
		total[c] = 0;
	for (i = 0; i < 256; ++i)
		for (c = 0; c < channels; ++c)
			total[c] = this.histogram[c*256+i] = total[c] + h[i*channels+c];

	//if this is the first update, set the last to the current
	if (this.lastHistogram.length != this.histogram.length)
		this.lastHistogram = this.histogram;

	this.status = 'Histogram success';
	return true;
};

//find the area of the top % peaks
//http://sujitpal.blogspot.com.au/2012/04/image-classification-photo-or-drawing.html
//https://stackoverflow.com/questions/9354744/how-to-detect-if-an-image-is-a-photo-clip-art-or-a-line-drawing
Histogram.prototype.getPeakArea = function(peak) {
	var lum = [];
	var last = 0.0;
	for (var i = 256*3; i < 256*4; ++i)
	{
		lum.push(this.histogram[i]-last);
		last = this.histogram[i];
	}
	var sorted = lum.sort();
	var top = sorted.slice(sorted.length - Math.floor(peak * sorted.length));
	return top.reduce(function(a, b) {return a + b;});
};

//computes golay merit for luminance channel
//http://people.math.sfu.ca/~jed/Papers/Jedwab.%20Merit%20Factor%20Survey.%202005.pdf
//http://www.cecm.sfu.ca/personal/pborwein/PAPERS/P218.pdf
//FIXME: not sure this is giving useful values
Histogram.prototype.getGolayMerit = function() {
	var a = this.histogram;
	var C = function(N, k){
		var r = 0;
		for (var j = 0; j < N - k - 2; ++j)
			r += (a[256*3+j]*2-1) * (a[256*3+(j+k)]*2-1);
		return r;
	};
	var E = function(N){
		var r = 0;
		for (var i = 1; i < N - 2; ++i)
		{
			var v = C(N, i);
			r += v * v;
		}
		return r;
	};
	var N = 256;
	return N * N / (2 * E(N));
};

Histogram.prototype.loadError = function(event) {
	this.status = 'Failed to load image (img.onerror fired). No idea why.';
	this.ready = true;
	if (this.onerror)
		this.onerror(this);
};

Histogram.prototype.loaded = function() {
	this.status = 'Loaded';
	this.success = this.updateHistogram(this.drawObject);
	this.attemptsLeft -= 1;
	if (!this.success)
	{
		if (this.attemptsLeft > 0)
		{
			window.setTimeout(this.loaded.bind(this), 1000);
			return;
		}
		else
			console.error("Failed to compute histogram for " + this.src);
	}

	this.ready = true;

	var callback = this.success ? this.onload : this.onerror;
	if (callback)
		callback(this);

	if (this.animated)
		this.timer = window.setInterval(this.update.bind(this), this.updateInterval);
};

Histogram.prototype.update = function() {
	this.updateHistogram(this.drawObject);
	if (this.onupdate)
		this.onupdate(this);
};
