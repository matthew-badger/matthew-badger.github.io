var u1, u2, u3, xpos, ypos, zpos, xold, yold, zold;

var reset = true;
var loop = true;

var cvs = document.getElementById("thecube");
var c = cvs.getContext("2d");

xpos = 222;
ypos = 222;
zpos = 0;

function slant(x,z) {
 var w = x;
 if (z>0) { w += (73/145)*z }
 else if (z<0) { w += (72/145)*z }
 
 return w;
}

cvs.addEventListener("click", 
        function(){ 
            reset = true;
            xpos = event.offsetX;
            ypos = event.offsetY;
            zpos = 0;
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
        zold = zpos;
        
        c.fillStyle = "#ffffff";
        c.fillRect(0,0,445,445);

        c.lineWidth = 3;

        // draw cube as stack of squares (yellow)
        for(xs=-72;xs<=73;xs+=5){
        c.fillStyle = "rgba(255,255," + (133+xs) + ", 0.08)";
        c.fillRect(77+xs, 77+xs, 290, 290);
        
        if(xs==3) {
        c.strokeStyle="rgb(128,128,128)";
        } else {
          c.strokeStyle = "rgba(" + (255- Math.round((xs+72)*255/145)) + "," + Math.round((xs+72)*255/145) + "," + Math.round((xs+72)*255/145) + ",0.4)";
        }
        c.beginPath();
        c.moveTo(77+xs,77+xs);
        c.lineTo(367+xs,77+xs);
        c.lineTo(367+xs,367+xs);
        c.lineTo(77+xs,367+xs);
        c.lineTo(77+xs,77+xs);
        c.stroke(); 
        }
        
        for(xs=0;xs<=145;xs+=5){
        c.strokeStyle="rgb(" + Math.round(xs*255/145) + "," + Math.round(xs*255/145) + "," + Math.round(xs*255/145) + ")";
        c.beginPath();
        c.moveTo(5+xs,5+xs);
        c.lineTo(10+xs,10+xs);
        c.stroke();
        c.moveTo(5+xs,295+xs);
        c.lineTo(10+xs,300+xs);
        c.stroke();
        c.moveTo(295+xs,295+xs);
        c.lineTo(300+xs,300+xs);
        c.stroke();
        c.moveTo(295+xs,5+xs);
        c.lineTo(300+xs,10+xs);
        c.stroke();
        }
        
        c.lineWidth = 2;
        
        // draw starting point (green)
        c.fillStyle = "#00bb33";
        c.beginPath();
        c.arc(slant(xpos,zpos), slant(ypos,zpos), 5, 0, 2*Math.PI, false);
        c.fill();
    }

    if (xpos<=77 || xpos>=367 || ypos<=77 || ypos>=367 || zpos <=-145 || zpos >=145) {
        if (xpos>367) {
            xpos=367; 
        }
        else if (xpos<77) {
            xpos=77;
        }
        
        if (ypos>367) {
            ypos=367;
        }
        else if (ypos<77) {
            ypos=77;
        }
        
        if (zpos>145) {
            zpos=145;
        }
        else if (zpos<-145) {
             zpos=-145;
        }    
        
        c.strokeStyle = "rgba(" + Math.round((zpos+145)*255/290) + "," + Math.round((zpos+145)*255/290) + "," + Math.round((zpos+145)*255/290) + ",0.8)";
        c.beginPath();
        c.moveTo(slant(xold,zold),slant(yold,zold));
        c.lineTo(slant(xpos,zpos),slant(ypos,zpos));
        c.stroke();
        loop = false;
        
        c.fillStyle = "#ff1100";
        c.beginPath();
        c.arc(slant(xpos,zpos), slant(ypos,zpos), 5, 0, 2*Math.PI, false);
        c.fill();
    } else {
        c.strokeStyle = "rgba(" + Math.round((zpos+145)*255/290) + "," + Math.round((zpos+145)*255/290) + "," + Math.round((zpos+145)*255/290) + ",0.8)";
        c.beginPath();
        c.moveTo(slant(xold,zold),slant(yold,zold));
        c.lineTo(slant(xpos,zpos),slant(ypos,zpos));
        c.stroke();

        u1 = Math.random();
        u2 = Math.random();
        u3 = Math.random();
        xold = xpos;
        yold = ypos;
        zold = zpos;
        xpos += 4*Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)*Math.sin(2*Math.PI*u3);
        ypos += 4*Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2)*Math.sin(2*Math.PI*u3);
        zpos += 4*Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u3);
    }

  if (loop) { setTimeout(nextFrame, 5); }

}

nextFrame();
