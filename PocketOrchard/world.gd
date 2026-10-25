extends RefCounted
## All six courses are authored below in tile coordinates; no random generation.
const NAMES = ['CLOVER PATH','THE OLD AQUEDUCT','WINDMILL WAY','CELLAR STEPS','MOONLIT CANOPY','THE THORN ENGINE']
const REGIONS = ['THE LOW ORCHARD','THE LOW ORCHARD','THE WATER MILLS','THE WATER MILLS','THE NIGHT GARDEN','THE NIGHT GARDEN']
var tiles: Dictionary = {}
var seeds: Array = []
var enemies: Array = []
var platforms: Array = []
var width: int = 152
var index: int = 0
var bonus: bool = false
var entrance := Vector2(-100,-100)
var exit := Vector2(2352,112)
var checkpoint := Vector2(1136,112)
var spawn := Vector2(32,112)
var secret_return := Vector2.ZERO

func put(x: int, y: int, kind: int) -> void:
	tiles[Vector2i(x,y)] = kind

func floor_span(a: int, b: int, top: int = 7, kind: int = 1) -> void:
	for x in range(a,b+1):
		for y in range(top,9): put(x,y,kind if y==top else (2 if kind==1 else kind))

func shelf(a: int, b: int, y: int, kind: int = 3) -> void:
	for x in range(a,b+1): put(x,y,kind)

func coin_row(a: int, b: int, y: int) -> void:
	for x in range(a,b+1): seeds.append({'p':Vector2(x*16+3,y*16+3),'taken':false})

func foe(x: int, y: int = 7, kind: String = 'beetle', patrol: bool = false) -> void:
	enemies.append({'p':Vector2(x*16,y*16-13),'v':Vector2(-20,0),'kind':kind,'alive':true,'age':float(x)*0.3,'patrol':patrol,'home':float(y*16-13),'flat':0.0})

func mover(x: int, y: int, distance: int, vertical: bool = false, phase: float = 0.0) -> void:
	platforms.append({'origin':Vector2(x*16,y*16),'p':Vector2(x*16,y*16),'old':Vector2(x*16,y*16),'distance':float(distance*16),'vertical':vertical,'phase':phase,'w':32.0})

func build(n: int, secret: bool = false) -> void:
	index=n
	bonus=secret
	if secret:
		width=30
		spawn=Vector2(24,112)
		floor_span(0,29,7,7)
		shelf(0,29,1,7)
		shelf(0,0,2,7)
		shelf(0,0,3,7)
		shelf(0,0,4,7)
		shelf(0,0,5,7)
		shelf(5,8,5,3)
		shelf(11,14,4,3)
		shelf(17,20,5,3)
		coin_row(4,8,4)
		coin_row(10,15,3)
		coin_row(17,22,4)
		coin_row(6,24,6)
		put(24,4,11)
		checkpoint=Vector2(-100,-100)
		exit=Vector2(27*16,112)
		return
	match n:
		0:
			for span in [[0,28],[32,60],[64,96],[100,151]]: floor_span(span[0],span[1])
			put(10,4,4); put(11,4,3); put(12,4,5); put(13,4,3)
			coin_row(21,24,5)
			floor_span(23,24,6); floor_span(25,26,5); floor_span(27,28,4)
			coin_row(28,33,2)
			shelf(37,41,4); put(39,4,11)
			coin_row(37,41,3)
			floor_span(47,48,6); floor_span(49,51,5)
			put(55,4,4); put(57,4,4)
			shelf(67,72,5,8); coin_row(68,71,4)
			put(79,4,5); put(81,4,3); put(82,4,4)
			shelf(86,89,5,3); shelf(90,94,3,8)
			entrance=Vector2(91*16,48)
			coin_row(93,95,2)
			floor_span(105,107,6); floor_span(108,110,5)
			coin_row(109,111,4)
			put(118,4,11); put(120,4,4)
			floor_span(129,130,6); floor_span(131,132,5); floor_span(133,134,4)
			for x in [18,42,56,76,111,124,138]: foe(x)
			foe(88,5,'hopper')
		1:
			for span in [[0,19],[24,43],[48,69],[74,94],[99,120],[125,151]]: floor_span(span[0],span[1],7,7)
			put(8,4,5); shelf(13,17,5,8); coin_row(13,17,4)
			mover(20,6,2,false)
			shelf(29,33,5,8); shelf(35,38,3,8); coin_row(29,33,4)
			put(37,3,11); entrance=Vector2(36*16,48)
			mover(44,6,2,false,1.3)
			shelf(53,56,5,8); put(59,4,4); put(61,4,5)
			mover(70,6,2,false,0.7)
			shelf(79,83,5,8); coin_row(80,83,4)
			put(87,6,9); put(88,6,9)
			mover(95,6,2,false,1.7)
			put(105,4,11); shelf(110,113,5,8); shelf(116,119,4,8)
			coin_row(116,119,3); mover(121,6,2,false,2.0)
			floor_span(129,131,6,7); floor_span(132,134,5,7)
			for x in [16,31,54,65,81,109,137]: foe(x,7,'hopper' if x%2 else 'beetle',true)
			foe(91,4,'moth'); foe(116,3,'moth')
		2:
			for span in [[0,25],[29,49],[53,76],[80,104],[109,129],[133,151]]: floor_span(span[0],span[1])
			put(8,4,5); shelf(15,18,5,8); coin_row(15,18,4)
			put(23,6,10); shelf(25,30,3,8); coin_row(25,30,2)
			mover(35,6,-3,true); shelf(38,42,3,8); put(40,3,11)
			entrance=Vector2(41*16,48)
			mover(49,6,2,false)
			floor_span(57,59,6); floor_span(60,62,5)
			put(68,4,4); put(70,4,5)
			mover(77,6,2,false,1.1)
			mover(85,6,-3,true,2.0); shelf(88,92,3,8); coin_row(88,92,2)
			shelf(95,99,5,8); coin_row(96,99,4)
			put(103,6,10); shelf(105,110,3,8)
			put(116,4,11); put(118,4,4)
			mover(130,6,2,false,0.5)
			for x in [18,39,62,86,99,121,141]: foe(x,7,'beetle',true)
			for x in [31,56,92,112,135]: foe(x,4,'moth')
		3:
			for span in [[0,22],[26,48],[52,74],[78,101],[106,127],[131,151]]: floor_span(span[0],span[1],7,7)
			shelf(0,150,1,7)
			put(8,4,5); shelf(14,17,5,7); shelf(18,21,4,7); coin_row(18,21,3)
			put(28,4,11); shelf(33,37,5,3); coin_row(33,37,4)
			floor_span(41,43,6,7); floor_span(44,47,5,7)
			coin_row(47,51,3); shelf(54,58,5,8)
			put(62,6,9); put(63,6,9); put(67,4,5)
			shelf(71,74,5,7); mover(75,6,2,false)
			shelf(82,86,5,3); put(83,5,4); put(85,5,4)
			put(90,4,11); shelf(94,97,5,7); shelf(98,101,3,8)
			entrance=Vector2(99*16,48)
			mover(102,6,2,false,1.0)
			floor_span(112,114,6,7); floor_span(115,117,5,7)
			coin_row(115,117,4); put(122,4,5)
			mover(128,6,2,false,0.5)
			for x in [17,35,56,69,87,112,137]: foe(x,7,'hopper',true)
			foe(121,4,'moth')
		4:
			for span in [[0,21],[25,45],[49,71],[75,97],[101,123],[127,151]]: floor_span(span[0],span[1])
			put(8,4,5); shelf(14,18,5,8); shelf(19,22,3,8)
			coin_row(19,24,2); mover(22,6,2,false)
			put(31,4,11); shelf(36,39,5,8)
			mover(42,5,-2,true,0.3); shelf(44,49,3,8)
			entrance=Vector2(46*16,48)
			coin_row(44,49,2); floor_span(54,57,6)
			put(60,6,9); put(61,6,9); put(66,4,5)
			mover(72,6,2,false,1.2)
			mover(80,6,-3,true,1.2); shelf(83,87,3,8); put(85,3,4)
			coin_row(89,94,5); mover(98,6,2,false,1.2)
			put(106,4,11); shelf(112,115,5,8); shelf(117,120,3,8)
			coin_row(117,120,2); mover(124,6,2,false,0.2)
			for x in [17,33,56,84,111,135]: foe(x,7,'hopper',true)
			for x in [29,51,68,94,118,139]: foe(x,4,'moth')
		5:
			width=168
			exit=Vector2(164*16,112)
			for span in [[0,24],[28,50],[54,75],[79,100],[104,167]]: floor_span(span[0],span[1],7,7)
			shelf(0,140,1,7)
			put(8,4,11); floor_span(16,18,6,7)
			put(21,6,9); put(22,6,9); mover(25,6,2,false)
			shelf(32,35,5,8); put(36,4,5)
			shelf(41,44,5,7); shelf(45,48,3,8)
			entrance=Vector2(46*16,48)
			mover(51,6,2,false,0.5); put(58,4,11)
			put(64,6,9); put(65,6,9); shelf(62,66,4,8)
			coin_row(62,66,3); put(72,4,5)
			mover(76,6,2,false,1.5)
			floor_span(85,87,6,7); floor_span(88,90,5,7)
			coin_row(88,90,4); put(94,6,9); put(95,6,9)
			mover(101,6,2,false,0.9); put(110,4,11)
			checkpoint=Vector2(116*16,112)
			shelf(120,122,5,8); shelf(126,128,4,8); shelf(132,134,5,8)
			coin_row(121,122,4); coin_row(126,128,3)
			for x in [18,38,59,70,87,109]: foe(x,7,'hopper',true)
			for x in [43,82,99]: foe(x,4,'moth')
	# Exit has a safe approach and a bell tower, shared by the six courses.
	if n < 5:
		floor_span(142,151,7,1 if n%2==0 else 7)
		checkpoint=Vector2(72*16,112)

func tile_at(x: int, y: int) -> int:
	if x<0: return 7
	return int(tiles.get(Vector2i(x,y),0))

func solid(x: int, y: int, include_hidden: bool = false) -> bool:
	var t := tile_at(x,y)
	return t>0 and t!=9 and t!=10 and (t!=12 or include_hidden)
