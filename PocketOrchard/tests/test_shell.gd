extends SceneTree
var shell: Control
var failed:=false
func _initialize() -> void: call_deferred('run')
func check(value: bool, message: String) -> void:
	if not value: failed=true;push_error(message)
func touch(id: int, p: Vector2, down: bool) -> void:
	var e:=InputEventScreenTouch.new()
	e.index=id;e.position=p;e.pressed=down
	shell._input(e)
func drag(id: int, p: Vector2) -> void:
	var e:=InputEventScreenDrag.new()
	e.index=id;e.position=p
	shell._input(e)
func run() -> void:
	root.size=Vector2i(960,540)
	shell=load('res://main.tscn').instantiate()
	root.add_child(shell)
	shell.game.quiet_test=true
	shell.game.set_physics_process(false)
	await process_frame
	shell.layout()
	var b: Vector2=shell.regions['run'].get_center()
	var a: Vector2=shell.regions['jump'].get_center()
	touch(0,shell.pad_center+Vector2(shell.pad_size,0),true)
	touch(1,b,true)
	check(shell.game.held('right') and shell.game.held('run'),'Two thumbs can steer and run simultaneously.')
	drag(1,a)
	check(shell.game.held('right') and shell.game.held('run') and shell.game.held('jump'),'Sliding B to A keeps run held while jumping.')
	touch(1,a,false)
	check(not shell.game.held('run') and not shell.game.held('jump') and shell.game.held('right'),'Lifting the action thumb releases both action buttons independently of steering.')
	touch(0,shell.pad_center,false)
	check(not shell.game.held('right'),'Releasing the D-pad stops steering.')
	touch(2,a,true)
	check(shell.game.held('jump') and not shell.game.held('run'),'A fresh A press does not inherit an old run latch.')
	shell._notification(Control.NOTIFICATION_APPLICATION_FOCUS_OUT)
	check(shell.game.controls.is_empty() and shell.fingers.is_empty(),'Losing focus clears all held touch input.')
	root.size=Vector2i(540,960)
	await process_frame
	shell.layout()
	check(shell.lcd.size.x<=root.size.x and shell.lcd.end.y<root.size.y,'Portrait keeps the complete LCD inside the display.')
	check(is_equal_approx(shell.lcd.size.x/shell.lcd.size.y,160.0/144.0),'Resizing preserves the original LCD aspect ratio.')
	print('POCKET ORCHARD: touch and layout ', 'FAILED' if failed else 'PASSED')
	shell.queue_free()
	await process_frame
	quit(1 if failed else 0)
