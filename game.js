const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

ctx.fillStyle = "green";
ctx.fillRect(0,0,canvas.width,canvas.height);

ctx.fillStyle = "red";
ctx.beginPath();
ctx.arc(
    canvas.width/2,
    canvas.height/2,
    40,
    0,
    Math.PI*2
);
ctx.fill();