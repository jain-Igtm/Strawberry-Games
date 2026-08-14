#include <jni.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "third_party/signalsmith-stretch.h"

namespace {

using Stretch = signalsmith::stretch::SignalsmithStretch<float>;

struct Note {
    double startSeconds;
    double endSeconds;
    double sourceMidi;
    int targetMidi;
};

struct ConstMonoBuffer {
    const float *samples;
    struct Channel {
        const float *samples;
        float operator[](int index) const { return samples[index]; }
    };
    Channel operator[](int) const { return {samples}; }
};

struct MonoBuffer {
    float *samples;
    struct Channel {
        float *samples;
        float &operator[](int index) const { return samples[index]; }
    };
    Channel operator[](int) const { return {samples}; }
};

std::string fromJava(JNIEnv *env, jstring value) {
    if (!value) throw std::invalid_argument("Missing PCM file path");
    const char *utf = env->GetStringUTFChars(value, nullptr);
    if (!utf) throw std::runtime_error("Could not read PCM file path");
    std::string result(utf);
    env->ReleaseStringUTFChars(value, utf);
    return result;
}

std::vector<float> readPcm16(const std::string &path) {
    std::ifstream stream(path, std::ios::binary | std::ios::ate);
    if (!stream) throw std::runtime_error("Could not open the recorded PCM audio");
    const std::streamsize byteCount = stream.tellg();
    if (byteCount < 0 || byteCount % 2 != 0) throw std::runtime_error("Recorded PCM audio is damaged");
    stream.seekg(0, std::ios::beg);
    std::vector<std::int16_t> pcm(static_cast<std::size_t>(byteCount / 2));
    if (!pcm.empty() && !stream.read(reinterpret_cast<char *>(pcm.data()), byteCount)) {
        throw std::runtime_error("Could not read the recorded PCM audio");
    }
    std::vector<float> result(pcm.size());
    for (std::size_t i = 0; i < pcm.size(); ++i) result[i] = pcm[i] / 32768.0f;
    return result;
}

void writePcm16(const std::string &path, const std::vector<float> &samples, std::size_t count,
                double gain) {
    std::ofstream stream(path, std::ios::binary | std::ios::trunc);
    if (!stream) throw std::runtime_error("Could not create the corrected PCM audio");
    std::vector<std::int16_t> pcm(count);
    for (std::size_t i = 0; i < count; ++i) {
        const double scaled = std::clamp(samples[i] * gain, -1.0, 0.999969482421875);
        pcm[i] = static_cast<std::int16_t>(std::lrint(scaled * 32768.0));
    }
    if (!pcm.empty()) {
        stream.write(reinterpret_cast<const char *>(pcm.data()),
                     static_cast<std::streamsize>(pcm.size() * sizeof(std::int16_t)));
    }
    if (!stream) throw std::runtime_error("Could not write the corrected PCM audio");
}

const Note *noteAt(const std::vector<Note> &notes, double seconds, std::size_t &cursor) {
    while (cursor < notes.size() && seconds > notes[cursor].endSeconds) ++cursor;
    if (cursor < notes.size() && seconds >= notes[cursor].startSeconds
            && seconds <= notes[cursor].endSeconds) return &notes[cursor];
    return nullptr;
}

double midiFrequency(double midi) {
    return 440.0 * std::pow(2.0, (midi - 69.0) / 12.0);
}

void renderSpectral(const std::string &inputPath, const std::string &outputPath, int sampleRate,
                    const std::vector<Note> &notes, double depth, double tuneTimeMs,
                    double formantSemitones, bool preserveFormants, double gainDb) {
    if (sampleRate < 8000) throw std::invalid_argument("Unsupported recording sample rate");
    std::vector<float> source = readPcm16(inputPath);
    const std::size_t sourceLength = source.size();
    if (sourceLength == 0) throw std::runtime_error("The recording is empty");

    Stretch stretch;
    stretch.presetDefault(1, static_cast<float>(sampleRate));
    stretch.setFormantSemitones(static_cast<float>(std::clamp(formantSemitones, -12.0, 12.0)),
                               preserveFormants);

    const int interval = stretch.intervalSamples();
    const int seekLength = stretch.outputSeekLength(1.0f);
    const std::size_t renderLength = std::max<std::size_t>(
            sourceLength, static_cast<std::size_t>(seekLength + interval * 2));
    const int processOutput = static_cast<int>(renderLength) - interval;
    const int inputNeeded = processOutput + seekLength;
    source.resize(static_cast<std::size_t>(inputNeeded), 0.0f);
    std::vector<float> output(renderLength, 0.0f);

    std::size_t noteCursor = 0;
    const Note *initialNote = noteAt(notes, 0.0, noteCursor);
    double smoothedSemitones = 0.0;
    if (initialNote) {
        smoothedSemitones = (initialNote->targetMidi - initialNote->sourceMidi) * depth;
        stretch.setFormantBase(static_cast<float>(midiFrequency(initialNote->sourceMidi) / sampleRate));
    } else {
        stretch.setFormantBase(0);
    }
    smoothedSemitones = std::clamp(smoothedSemitones, -24.0, 24.0);
    stretch.setTransposeSemitones(static_cast<float>(smoothedSemitones),
                                  static_cast<float>(8000.0 / sampleRate));
    stretch.outputSeek(ConstMonoBuffer{source.data()}, seekLength);

    constexpr int automationBlock = 256;
    int inputOffset = seekLength;
    int outputOffset = 0;
    noteCursor = 0;
    const double tuneSeconds = std::max(0.0, tuneTimeMs) / 1000.0;
    while (outputOffset < processOutput) {
        const int count = std::min(automationBlock, processOutput - outputOffset);
        const double processingSeconds = (outputOffset + stretch.outputLatency())
                                         / static_cast<double>(sampleRate);
        const Note *active = noteAt(notes, processingSeconds, noteCursor);
        double wantedSemitones = 0.0;
        if (active) wantedSemitones = (active->targetMidi - active->sourceMidi) * depth;
        wantedSemitones = std::clamp(wantedSemitones, -24.0, 24.0);
        if (tuneSeconds <= 0.000001) {
            smoothedSemitones = wantedSemitones;
        } else {
            const double alpha = 1.0 - std::exp(-count / (sampleRate * tuneSeconds));
            smoothedSemitones += (wantedSemitones - smoothedSemitones) * alpha;
        }
        stretch.setTransposeSemitones(static_cast<float>(smoothedSemitones),
                                      static_cast<float>(8000.0 / sampleRate));
        stretch.setFormantBase(active
                ? static_cast<float>(midiFrequency(active->sourceMidi) / sampleRate)
                : 0.0f);
        stretch.process(ConstMonoBuffer{source.data() + inputOffset}, count,
                        MonoBuffer{output.data() + outputOffset}, count);
        inputOffset += count;
        outputOffset += count;
    }
    stretch.flush(MonoBuffer{output.data() + outputOffset}, interval, 1.0f);

    const double gain = std::pow(10.0, std::clamp(gainDb, -24.0, 24.0) / 20.0);
    writePcm16(outputPath, output, sourceLength, gain);
}

void throwJava(JNIEnv *env, const std::string &message) {
    jclass type = env->FindClass("java/lang/IllegalStateException");
    if (type) env->ThrowNew(type, message.c_str());
}

}  // namespace

extern "C" JNIEXPORT void JNICALL
Java_com_strawberry_pitchstudio_PitchRenderer_renderNative(
        JNIEnv *env, jclass, jstring inputPath, jstring outputPath, jint sampleRate,
        jdoubleArray starts, jdoubleArray ends, jdoubleArray sources, jintArray targets,
        jdouble depth, jdouble tuneTimeMs, jdouble formantSemitones,
        jboolean preserveFormants, jdouble gainDb) {
    try {
        const jsize count = env->GetArrayLength(starts);
        if (env->GetArrayLength(ends) != count || env->GetArrayLength(sources) != count
                || env->GetArrayLength(targets) != count) {
            throw std::invalid_argument("Pitch edit arrays do not match");
        }
        std::vector<jdouble> startValues(static_cast<std::size_t>(count));
        std::vector<jdouble> endValues(static_cast<std::size_t>(count));
        std::vector<jdouble> sourceValues(static_cast<std::size_t>(count));
        std::vector<jint> targetValues(static_cast<std::size_t>(count));
        env->GetDoubleArrayRegion(starts, 0, count, startValues.data());
        env->GetDoubleArrayRegion(ends, 0, count, endValues.data());
        env->GetDoubleArrayRegion(sources, 0, count, sourceValues.data());
        env->GetIntArrayRegion(targets, 0, count, targetValues.data());
        if (env->ExceptionCheck()) return;

        std::vector<Note> notes;
        notes.reserve(static_cast<std::size_t>(count));
        for (jsize i = 0; i < count; ++i) {
            notes.push_back({startValues[i], endValues[i], sourceValues[i], targetValues[i]});
        }
        renderSpectral(fromJava(env, inputPath), fromJava(env, outputPath), sampleRate, notes,
                       std::clamp(static_cast<double>(depth), 0.0, 1.0), tuneTimeMs,
                       formantSemitones, preserveFormants == JNI_TRUE, gainDb);
    } catch (const std::exception &error) {
        throwJava(env, error.what());
    } catch (...) {
        throwJava(env, "The formant-aware render failed unexpectedly");
    }
}
