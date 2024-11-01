var u1, u2, xpos, ypos, xold, yold;

var reset = true;
var loop = true;

var cvs = document.getElementById("thesquare");
var c = cvs.getContext("2d");

xpos = 150;
ypos = 150;

cvs.addEventListener("click", 
        function(){ 
            reset = true;
            xpos = event.offsetX;
            ypos = event.offsetY;
            if (!loop) { loop=true; nextFrame(); }
        },
        false);

function getRelativeCoords(event) {
    return { x: event.offsetX, y: event.offsetY };
}

function nextFrame() {
    if (reset) {
        reset = false;
        xold = xpos;
        yold = ypos;
        
        c.fillStyle = "#ffffff";
        c.fillRect(0,0,300,300);

        // draw square domain (yellow)
        c.fillStyle = "#ffff99";
        c.fillRect(5, 5, 290, 290);

        // highlight top boundary (teal)
        c.lineWidth = 3;
        c.strokeStyle = "#3366ff";
        c.beginPath();
        c.moveTo(5,5);
        c.lineTo(102,5);
        c.moveTo(199,5);
        c.lineTo(295,5);
        c.lineTo(295,102);
        c.moveTo(295,199);
        c.lineTo(295,295);
        c.lineTo(199,295);
        c.moveTo(102,295);
        c.lineTo(5,295);
        c.lineTo(5,199);
        c.moveTo(5,102);
        c.lineTo(5,5);
        c.stroke();
        
        c.strokeStyle = "#66bd48";
        c.beginPath();
        c.moveTo(102,5);
        c.lineTo(199,5);
        c.moveTo(102,295);
        c.lineTo(199,295);
        c.moveTo(5,102);
        c.lineTo(5,199);
        c.moveTo(295,102);
        c.lineTo(295,199);
        c.stroke()
        
        c.lineWidth = 2;
        
        // draw starting point (green)
        c.fillStyle = "#00bb33";
        c.beginPath();
        c.arc(xpos, ypos, 5, 0, 2*Math.PI, false);
        c.fill();
    }

    if (xpos<=5 || xpos>=295 || ypos<=5 || ypos>=295) {
        if (xpos>295) {
            xpos=295; 
        }
        else if (xpos<5) {
            xpos=5;
        }
        else if (ypos>295) {
            ypos=295;
        }
        else if (ypos<5) {
            ypos=5;
        }    
        
        c.strokeStyle = "#112233";
        c.beginPath();
        c.moveTo(xold,yold);
        c.lineTo(xpos,ypos);
        c.stroke();
        loop = false;
        
        c.fillStyle = "#ff1100";
        c.beginPath();
        c.arc(xpos, ypos, 5, 0, 2*Math.PI, false);
        c.fill();
    } else {
        c.strokeStyle = "#112233";
        c.beginPath();
        c.moveTo(xold,yold);
        c.lineTo(xpos,ypos);
        c.stroke();

        u1 = Math.random();
        u2 = Math.random();
        xold = xpos;
        yold = ypos;
        xpos += 4*Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
        ypos += 4*Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2);
    }

  if (loop) { setTimeout(nextFrame, 5); }

}

nextFrame();
