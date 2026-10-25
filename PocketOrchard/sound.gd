extends Node
## Original pulse melodies, triangle bass and noise percussion. No sampled assets.
var muted := false
var players: Array = []
var songs: Array = []
var music: AudioStreamPlayer
var effects: Dictionary = {}
const RATE := 22050
const TUNE = [
	[76,0,79,0,83,79,76,74,72,0,76,0,79,0,76,0,74,0,77,0,81,77,74,72,71,0,74,0,79,0,0,0,76,0,79,0,84,83,81,79,77,0,81,0,84,0,81,0,79,76,74,72,71,74,79,77,76,0,72,0,72,0,0,0],
	[72,0,79,76,0,79,81,0,79,0,76,0,74,0,0,0,74,0,81,77,0,81,83,0,81,0,77,0,76,0,0,0,76,0,83,79,0,83,84,0,83,0,79,0,77,0,76,0,74,77,81,79,77,76,74,72,71,0,74,0,79,0,0,0],
	[69,0,72,0,76,0,79,76,74,0,72,0,71,0,0,0,69,0,72,0,77,0,81,77,76,0,74,0,72,0,0,0,72,0,76,0,79,0,83,79,81,0,79,0,76,0,74,0,72,71,69,0,68,0,71,0,76,0,71,0,69,0,0,0]
]

func _ready() -> void:
	music=AudioStreamPlayer.new()
	music.volume_db=-12
	add_child(music)
	for i in 6:
		var p:=AudioStreamPlayer.new()
		p.volume_db=-10
		add_child(p)
		players.append(p)
	for tune in 3: songs.append(make_song(tune))
	effects['jump']=effect([420,540,640],0.035)
	effects['seed']=effect([1050,1550],0.045)
	effects['bump']=effect([160,100],0.025)
	effects['stomp']=effect([190,80],0.045)
	effects['power']=effect([392,494,587,784,988,1175],0.055)
	effects['hurt']=effect([440,330,220,110],0.065)
	effects['spring']=effect([200,350,600,950],0.04)
	effects['shot']=effect([780,390,195],0.022)
	effects['life']=effect([660,880,1100,1320],0.08)
	effects['clear']=effect([523,659,784,1047,784,1047,1319],0.1)
	effects['lose']=effect([494,440,392,330,294,220],0.13)

func frequency(note: int) -> float:
	return 440.0*pow(2.0,(note-69)/12.0)

func wave(bytes: PackedByteArray, looped: bool = false) -> AudioStreamWAV:
	var stream:=AudioStreamWAV.new()
	stream.format=AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate=RATE
	stream.data=bytes
	if looped:
		stream.loop_mode=AudioStreamWAV.LOOP_FORWARD
		stream.loop_begin=0
		stream.loop_end=bytes.size()/2
	return stream

func effect(notes: Array, duration: float) -> AudioStreamWAV:
	var bytes:=PackedByteArray()
	var count:=int(RATE*duration)
	bytes.resize(count*notes.size()*2)
	for n in notes.size():
		for j in count:
			var t:=float(j)/RATE
			var envelope:=minf(t*400,1.0)*(1.0-float(j)/count)
			var v:=0.3*envelope*(1.0 if fmod(t*notes[n],1.0)<0.25 else -1.0)
			bytes.encode_s16((n*count+j)*2,int(v*20000))
	return wave(bytes)

func make_song(theme: int) -> AudioStreamWAV:
	var step:=0.13 if theme<2 else 0.15
	var count:=int(RATE*step)
	var bytes:=PackedByteArray()
	bytes.resize(count*64*2)
	var roots: Array = [48,53,55,48] if theme<2 else [45,50,52,45]
	var noise:=1
	for n in 64:
		var note: int=TUNE[theme][n]
		var bass: int=roots[n/16]+(12 if n%4==2 else 0)
		for j in count:
			var t:=float(j)/RATE
			var env:=minf(t*200,1.0)*maxf(0.0,1.0-float(j)/count)
			var v:=0.0
			if note>0: v+=(1.0 if fmod(t*frequency(note),1.0)<0.25 else -1.0)*0.17*env
			if n%2==0: v+=(4.0*absf(fmod(t*frequency(bass),1.0)-0.5)-1.0)*0.17*env
			if n%4==0 or n%4==2:
				noise=(noise*1103515245+12345)&0x7fffffff
				v+=(float(noise%2000)/1000.0-1.0)*0.08*exp(-t*65)
			bytes.encode_s16((n*count+j)*2,int(clampf(v,-1,1)*24000))
	return wave(bytes,true)

func play_song(theme: int) -> void:
	if music.stream==songs[theme] and music.playing: return
	music.stream=songs[theme]
	if not muted: music.play()

func sfx(key: String) -> void:
	if muted or not effects.has(key): return
	for p in players:
		if not p.playing:
			p.stream=effects[key]
			p.play()
			return

func toggle() -> void:
	muted=not muted
	if muted:
		music.stop()
		for p in players: p.stop()
	elif music.stream: music.play()

func _exit_tree() -> void:
	if music:
		music.stop()
		music.stream=null
	for p in players:
		p.stop()
		p.stream=null
	songs.clear()
	effects.clear()
