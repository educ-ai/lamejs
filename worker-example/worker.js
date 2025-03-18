(function () {
  'use strict';

  // [Worker Initialization]
  // Creates a separate environment for MP3 conversion so it doesn't block the main application.
  console.log('MP3 conversion worker started.');
  importScripts('../lame.all.js');
  importScripts("../utils.js");

  // [Shared Variables]
  // Stores encoding parameters and temporary data used throughout the process.
  var mp3Encoder, maxSamples = 1152,
    samplesLeft, config, dataBuffer, samplesRight;

  // [Buffer Reset]
  // Empties previously stored MP3 data, ensuring each new encoding starts clean.
  var clearBuffer = function () {
    dataBuffer = [];
  };

  // [Buffer Collection]
  // Retains MP3 segments as they are encoded, to be returned later as a complete file.
  var appendToBuffer = function (mp3Buf) {
    dataBuffer.push(new Int8Array(mp3Buf));
  };


  // [Initialization Phase]
  // Accepts user settings (bit rate, etc.) and prepares for a new encoding session.
  var init = function (prefConfig) {
    config = prefConfig || {};
    clearBuffer();
  };

  // [Wave Header Processing]
  // Extracts and organizes parameters needed for encoding.
  var extractParamsFromWav = function (arrayBuffer) {
    var wavHeader = lamejs.WavHeader.readHeader(new DataView(arrayBuffer));
    console.log('wave:', wavHeader);
    if (!wavHeader) {
      self.postMessage({cmd: 'error', msg: 'Specified file is not a Wave file'});
      return null;
    }

    // [Sample Extraction]
    var dataView = new Int16Array(arrayBuffer, wavHeader.dataOffset, wavHeader.dataLen / 2);
    var sampleChannels = {
      left: wavHeader.channels === 1 ? dataView : new Int16Array(wavHeader.dataLen / (2 * wavHeader.channels)),
      right: wavHeader.channels === 2 ? new Int16Array(wavHeader.dataLen / (2 * wavHeader.channels)) : undefined
    };

    // [Channel Splitting]
    if (wavHeader.channels > 1) {
      for (var i = 0; i < sampleChannels.left.length; i++) {
        sampleChannels.left[i] = dataView[i * 2];
        sampleChannels.right[i] = dataView[i * 2 + 1];
      }
    }

    return {
      sampleChannels,
      sampleRate: wavHeader.sampleRate
    };
  };

  // [Main Encoding Routine]
  // Handles reading the Wave file info, setting up the encoder, and processing the audio data in batches.
  var encode = function (arrayBuffer) {
    // [Wave Header Reading]
    // Extracts audio format details, ensuring it is valid before proceeding with MP3 conversion.
    const inputData = extractParamsFromWav(arrayBuffer)
    if (!inputData) {
      self.postMessage({cmd: 'error', msg: 'Specified file is not a Wave file'});
      return;
    }

    samplesLeft = inputData.sampleChannels.left
    samplesRight = inputData.sampleChannels.right
    const channelCount = samplesRight === undefined ? 1 : 2

    // [Encoder Configuration]
    // Aligns MP3 settings (channels, sample rate, bit rate) with the Wave data.
    mp3Encoder = new lamejs.Mp3Encoder(channelCount, inputData.sampleRate, config.outSampleRate || 0, config.bitRate || 96);

    // [Batch Processing Loop]
    // Breaks the audio into manageable chunks, encoding each piece and posting progress.
    var remaining = samplesLeft.length;
    for (var i = 0; remaining >= maxSamples; i += maxSamples) {
      // Extracts a chunk for each channel, preparing it for MP3 conversion.
      var left = samplesLeft.subarray(i, i + maxSamples);
      var right;
      if (samplesRight) {
        right = samplesRight.subarray(i, i + maxSamples);
      }

      // Encodes the current chunk, then appends the resulting MP3 frames to our buffer.
      var mp3buf = mp3Encoder.encodeBuffer(left, right);
      appendToBuffer(mp3buf);

      // Adjusts the remaining sample count and updates the main thread on progress.
      remaining -= maxSamples;
      self.postMessage({
        cmd: 'progress',
        progress: (1 - remaining / samplesLeft.length)
      });
    }
  };

  // [Finalization]
  // Completes encoding by flushing any pending frames, returning final MP3 data to the main thread.
  var finish = function () {
    var mp3buf = mp3Encoder.flush();
    appendToBuffer(mp3buf);
    self.postMessage({
      cmd: 'end',
      buf: dataBuffer
    });
    console.log('done encoding');
    clearBuffer(); //free up memory
  };

  // [Message Interface]
  // Responds to commands from the main script, coordinating initialization, encoding, and termination.
  self.onmessage = function (e) {
    switch (e.data.cmd) {
      case 'init':
        init(e.data.config);
        break;

      case 'encode':
        encode(e.data.rawInput);
        break;

      case 'finish':
        finish();
        break;
    }
  };

})();