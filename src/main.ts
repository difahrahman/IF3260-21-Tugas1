import { initShaderFiles } from './utils/shader';
import GLObject from './GLObject';
import Polygon from './Polygon';
import Line from './Line';
import Square from './Square';
import Renderer from './renderer';
import { saveJSON, loadJSON } from './utils/fileIO';

const Tool = {
  DRAW: 0,
  MOVE: 1,
  COLOR: 2,
};

const Shape = {
  LINE: 0,
  SQUARE: 1,
  POLYGON: 2,
};

window.onload = function () {
  var canvas = document.getElementById("gl-canvas") as HTMLCanvasElement;
  canvas.width = 400;
  canvas.height = 400;

  var gl = canvas.getContext("webgl2") as WebGL2RenderingContext;

  var objects: GLObject[] = [];

  // html element reference
  var toolPicker = document.getElementById("tool-picker") as HTMLSelectElement;
  var shapePicker = document.getElementById(
    "shape-picker"
  ) as HTMLSelectElement;
  var colorPicker = document.getElementById("color-picker") as HTMLInputElement;
  var drawPBtn = document.getElementById(
    "draw-polygon-btn"
  ) as HTMLButtonElement;
  var saveBtn = document.getElementById("save-model-btn") as HTMLButtonElement;
  var loadInput = document.getElementById("load-model") as HTMLInputElement;

  // tool variables
  var currentTool: number;
  var currentShape: number;
  var currentColor: number[];
  var selectedObject: GLObject;
  var selectedPoint: number;

  // input variables
  var mouseIsDown;
  var drawnVert = [];
  var id = 3;
  var doneDrawing = false;

  const renderer = new Renderer();

  toolPicker.onclick = function () {
    currentTool = toolPicker.selectedIndex;
    resetDrawingTool();
  };
  shapePicker.onclick = function () {
    currentShape = shapePicker.selectedIndex;
    resetDrawingTool();
  };
  colorPicker.oninput = function () {
    const colStr = colorPicker.value.match(/[\d\w]{1,2}/g);
    currentColor = [
      parseInt(colStr[0], 16) / 255,
      parseInt(colStr[1], 16) / 255,
      parseInt(colStr[2], 16) / 255,
      1,
    ];
  };

  async function main() {
    if (!gl) {
      alert("Your browser does not support WebGL");
      return;
    }

    const triangleData = [200.0, 200.0, 400.0, 200.0, 200.0, 400.0];

    const shaderProgram = await initShaderFiles(gl, "vert.glsl", "frag.glsl");
    const yellowShader = await initShaderFiles(
      gl,
      "vert.glsl",
      "frag-yellow.glsl"
    );

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    currentColor = [0, 0, 0, 1];

    drawPBtn.addEventListener("click", function (e) {
      // Button to trigger polygon drawing.
      if (currentTool == Tool.DRAW && currentShape == Shape.POLYGON) {
        if (drawnVert.length < 6) {
          alert("Letakan 3 titik atau lebih untuk membuat polygon.");
          resetDrawingTool();
        } else {
          drawShape(new Polygon(id, shaderProgram, gl), drawnVert);
        }
      }
    });

    saveBtn.addEventListener("click", function () {
      saveJSON(objects);
    });

    loadInput.addEventListener("change", function(e) {
      loadJSON(e.target.files[0], objects, shaderProgram, gl, renderer);
    })

    canvas.addEventListener("mousedown", function (e) {
      if (doneDrawing) {
        if (currentShape == Shape.LINE) {
          drawShape(new Line(id, shaderProgram, gl), drawnVert);
        } else if (currentShape == Shape.SQUARE) {
          let vertArray = [];
          vertArray.push(drawnVert[0]);
          vertArray.push(drawnVert[1]);
          console.log(vertArray);

          let distX = drawnVert[2] - drawnVert[0];
          let distY = drawnVert[3] - drawnVert[1];

          let size;
          if (distX < distY) {
            size = distX;
          } else {
            size = distY;
          }

          if ((distX > 0 && distY > 0) || (distX < 0 && distY < 0)) {
            // size sudah benar
            vertArray.push(drawnVert[0]);
            vertArray.push(drawnVert[1] + size);
            for (let i = 0; i < 2; i++) {
              vertArray.push(drawnVert[0] + size);
              vertArray.push(drawnVert[1]);
            }
            vertArray.push(drawnVert[0] + size);
            vertArray.push(drawnVert[1] + size);
            vertArray.push(drawnVert[0]);
            vertArray.push(drawnVert[1] + size);
          } else {
            if (distX > 0 && distY < 0) {
              size = -size;
            }
            vertArray.push(drawnVert[0]);
            vertArray.push(drawnVert[1] - size);
            for (let i = 0; i < 2; i++) {
              vertArray.push(drawnVert[0] + size);
              vertArray.push(drawnVert[1]);
            }
            vertArray.push(drawnVert[0] + size);
            vertArray.push(drawnVert[1] - size);
            vertArray.push(drawnVert[0]);
            vertArray.push(drawnVert[1] - size);
            //}
          }

          console.log(vertArray);
          //drawnVert[4] = vertArray[1] + size;

          drawShape(new Square(id, shaderProgram, gl), vertArray);
        }
      }
    });

    function render(now: number) {
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      renderer.render();
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  main();

  canvas.addEventListener("mousedown", function (event) {
    const bound = canvas.getBoundingClientRect();
    const mousePos = {
      x: event.clientX - bound.left,
      y: bound.bottom - event.clientY,
    };
    console.log(mousePos);

    if (currentTool === Tool.MOVE) {
      onMoveStart(mousePos);
    }

    if (currentTool === Tool.DRAW) {
      onDrawStart(mousePos);
    }

    if (currentTool === Tool.COLOR) {
      onColoring(mousePos);
    }

    mouseIsDown = true;
  });

  canvas.onmousemove = function (event) {
    const bound = canvas.getBoundingClientRect();
    const mousePos = {
      x: event.clientX - bound.left,
      y: bound.bottom - event.clientY,
    };

    // On Mouse Move (regardless of mouse down)

    if (!mouseIsDown) return;

    // On Drag
    if (currentTool === Tool.MOVE) {
      onMoveHold(mousePos);
    }

    return;
  };

  canvas.onmouseup = function (event) {
    // if(mouseIsDown) mouseClick(e);

    mouseIsDown = false;
  };

  function onDrawStart(mousePos: { x: number; y: number }) {
    drawnVert.push(mousePos.x);
    drawnVert.push(mousePos.y);
    console.log(drawnVert);
    if (currentShape === Shape.POLYGON) {
      //console.log(drawnVert);
    } else if (currentShape === Shape.LINE) {
      if (drawnVert.length >= 4) {
        doneDrawing = true;
      }
    } else if (currentShape == Shape.SQUARE) {
      if (drawnVert.length >= 4) {
        doneDrawing = true;
      }
    }
  }

  function onMoveStart(mousePos: { x: number; y: number }) {
    findNearest(mousePos);
  }

  function onMoveHold(mousePos: { x: number; y: number }) {
    if (selectedObject !== undefined) {
      selectedObject.onPointDrag(selectedPoint, mousePos);
    }
  }

  function onColoring(mousePos: { x: number; y: number }) {
    findNearest(mousePos);

    if (selectedObject !== undefined) {
      selectedObject.setColorArray(currentColor);
    } else {
      alert("Pilih titik dari bentuk yang ingin diwarnai.");
    }
  }

  function findNearest(mPos: { x: number; y: number }) {
    const nearestDistance = 30;
    let nearestDistanceSquared: number = nearestDistance * nearestDistance;
    let nearestObject: GLObject;
    let nearestPoint: number;

    objects.forEach((object) => {
      for (let i = 0; i < object.va.length / 2; i++) {
        console.log("test");
        const pt = { x: object.va[2 * i], y: object.va[2 * i + 1] };
        let distanceSquared =
          Math.pow(mPos.x - pt.x, 2) + Math.pow(mPos.y - pt.y, 2);
        if (nearestDistanceSquared > distanceSquared) {
          nearestDistanceSquared = distanceSquared;
          nearestObject = object;
          nearestPoint = i;
        }
      }
    });
    console.log("well", selectedObject);

    selectedObject = nearestObject;
    selectedPoint = nearestPoint;

    console.log(
      "Nearest Object: " + nearestObject + " Nearest point: " + nearestPoint
    );
  }

  function drawShape(newObj, vertList) {
    newObj.setVertexArray(vertList);
    newObj.setColorArray(currentColor);
    renderer.addObject(newObj);
    objects.push(newObj);
    id++;
    resetDrawingTool();
  }

  function resetDrawingTool() {
    drawnVert = [];
    doneDrawing = false;
  }
};
