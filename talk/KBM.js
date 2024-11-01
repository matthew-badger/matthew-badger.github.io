var u1, u2, xpos, ypos, xold, yold;
var radius = new Array(100);

var reset = true;
var loop = true;

var cvs = document.getElementById("KBM");
var c = cvs.getContext("2d");
c.lineWidth = 2;

cvs.addEventListener("click", 
        function(){ 
            reset = true;
            if (!loop) { loop=true; nextFrame(); }
        },
        false);

function nextFrame() {
    if (reset) {
        reset = false;
        xpos = xold = 150;
        ypos = yold = 150;

        c.fillStyle = "#fff";
        c.fillRect(0, 0, 300, 300);

        // generate random radii
        var offset1 = 2*Math.PI*Math.random();
        var offset2 = 2*Math.PI*Math.random();
        var offset3 = 2*Math.PI*Math.random();
        var r1 = 5 + 10*Math.random();
        var r2 = 5 + 10*Math.random();
        var r3 = 5 + 10*Math.random();

        for (var j=0; j<100; j++) {
            radius[j] = 120 +
                r1*Math.sin(offset1 + 4*Math.PI*j/100) +
                r2*Math.sin(offset2 + 6*Math.PI*j/100) +
                r3*Math.sin(offset3 + 8*Math.PI*j/100);
        }

        // draw region boundary
        c.fillStyle = "#fff8a4";
        c.beginPath();
        c.moveTo(150 + radius[0], 150);
        for (var j=1; j<100; j++) {
            c.lineTo(150 + radius[j]*Math.cos( 2*Math.PI*j/100 ),
                     150 + radius[j]*Math.sin( 2*Math.PI*j/100 ));
        }
        c.closePath();
        c.fill();
        
        c.fillStyle = "#264a59";
        c.beginPath();
        c.arc(150, 150, 3.5, 0, 2*Math.PI, false);
        c.fill();
    }

    // test to see if we're in the region
    rad2 = Math.pow(xpos-150,2) + Math.pow(ypos-150,2);
    theta = Math.atan2(ypos-150, xpos-150);
    if (theta<0) { theta += 2*Math.PI; }
    theta_index = Math.floor(100*theta/(2*Math.PI));

    if (rad2 > Math.pow(radius[theta_index],2)) {
        xpos = 150 + radius[theta_index]*Math.cos(2*Math.PI*theta_index/100);
        ypos = 150 + radius[theta_index]*Math.sin(2*Math.PI*theta_index/100);
        c.strokeStyle = "#264a59";
        c.beginPath();
        c.moveTo(xold,yold);
        c.lineTo(xpos,ypos);
        c.stroke();

        c.fillStyle = "#ba2f1d";
        c.beginPath();
        c.arc(xpos, ypos, 3.5, 0, 2*Math.PI, false);
        c.fill();

        loop = false;
    } else {
        c.strokeStyle = "#264a59";
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

    if (loop) { setTimeout(nextFrame, 20); }

}

nextFrame();
