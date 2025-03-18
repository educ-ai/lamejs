// pcm_utils.js

// Maximum positive value for a 16-bit signed integer
const INT16_MAX = 32767;

// Minimum negative value for a 16-bit signed integer
const INT16_MIN = -32768;

// Converts a Float32Array of audio samples (ranging from -1.0 to 1.0)
// into an Int16Array (ranging from -32768 to 32767).
// This is necessary because most audio formats (like MP3, WAV) expect 16-bit PCM data.
function floatTo16BitPCM(input) {
    // Create an output buffer of the same length as the input
    const output = new Int16Array(input.length);

    for (let i = 0; i < input.length; i++) {
        // Clamp the input sample to the valid range [-1.0, 1.0]
        let s = Math.max(-1, Math.min(1, input[i]));

        // Convert float to 16-bit PCM and store it in the output array
        output[i] = floatToInt16(s, INT16_MIN, INT16_MAX);
    }

    return output;
}

// Converts a single float sample (-1.0 to 1.0) into a 16-bit PCM integer.
// Negative values use INT16_MIN (-32768), positive values use INT16_MAX (32767).
function floatToInt16(s, INT16_MIN, INT16_MAX) {
    // If the sample is negative, multiply by -INT16_MIN (-32768)
    // If the sample is positive, multiply by INT16_MAX (32767) to avoid overflow
    return s < 0 ? s * -INT16_MIN : s * INT16_MAX;
}
