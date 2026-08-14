cmake_minimum_required(VERSION 3.22.1)

project(pitchstudio_dsp LANGUAGES CXX)

add_library(pitchstudio_dsp SHARED spectral_renderer.cpp)

target_include_directories(pitchstudio_dsp PRIVATE third_party)
target_compile_features(pitchstudio_dsp PRIVATE cxx_std_17)
target_compile_options(pitchstudio_dsp PRIVATE -O3 -ffast-math -Wall -Wextra)

