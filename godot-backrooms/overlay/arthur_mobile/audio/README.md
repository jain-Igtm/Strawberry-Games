# Arthur Backrooms pool water audio

The v0.11 Android build fetches three recorded water-loop OGG files during CI from the public repository `lavenderdotpet/CC0-Public-Domain-Sounds`, folder `40-cc0-water-splash-slime-sfx`, pinned to commit `f2b6264f9ab89fabc266914c3654685d68c5a39b`.

Files used:
- `loop_water_01.ogg`
- `loop_water_02.ogg`
- `loop_water_03.ogg`

The source repository and folder identify the collection as CC0 / public-domain sound material. The audio is fetched at build time and bundled into the exported APK. It replaces the synthesized `AudioStreamGenerator` waterfall wash for v0.11 pool architecture.
