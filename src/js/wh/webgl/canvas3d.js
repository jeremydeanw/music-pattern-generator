import {
  Color,
  DirectionalLight,
  LineBasicMaterial,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer 
} from '../../lib/three.module.js';
import addWindowResize from '../view/windowresize.js';
import { getThemeColors } from '../state/selectors.js';
import { util } from '../core/util.js';

export default function createCanvas3d(specs, my) {
  let that,
    store = specs.store,
    rootEl,
    canvasRect,
    renderer,
    scene,
    camera,
    plane,
    mousePoint = new Vector2(),
    intersection = new Vector3(),
    intersectionPrevious = new Vector3(),
    raycaster = new Raycaster(),
    intersectedObject,
    lineMaterial,
    dragObject,
    dragObjectType,
    dragOffset = new Vector3(),
    allObjects = [],
    controllers = [],
    doubleClickCounter = 0,
    doubleClickDelay = 300,
    doubleClickTimer,

    init = function() {
      my.addWindowResizeCallback(onWindowResize);
      initWorld();
      initDOMEvents();
      onWindowResize();
      draw();

      document.addEventListener(store.STATE_CHANGE, (e) => {
        switch (e.detail.action.type) {
                    
          case e.detail.actions.SELECT_PROCESSOR:
            selectProcessorView(e.detail.state);
            break;

          case e.detail.actions.ADD_PROCESSOR:
            createProcessorViews(e.detail.state);
            break;
                    
          case e.detail.actions.DELETE_PROCESSOR:
            deleteProcessorView(e.detail.action.id);
            selectProcessorView(e.detail.state);
            break;

          case e.detail.actions.CREATE_PROJECT:
            setThemeOnWorld();
            clearProcessorViews();
            createProcessorViews(e.detail.state);
            break;

          case e.detail.actions.SET_THEME:
            setThemeOnWorld();
            break;
        }
      });
    },
            
    /**
     * Initialise DOM events for click, drag etcetera.
     */
    initDOMEvents = function() {
      renderer.domElement.addEventListener(util.eventType.click, onClick);
      renderer.domElement.addEventListener(util.eventType.start, onTouchStart);
      renderer.domElement.addEventListener(util.eventType.move, dragMove);
      renderer.domElement.addEventListener(util.eventType.end, dragEnd);

      // prevent system doubleclick to interfere with the custom doubleclick
      renderer.domElement.addEventListener('dblclick', function(e) {e.preventDefault();});
    },

    /**
     * Window resize event handler.
     */
    onWindowResize = function() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      canvasRect = renderer.domElement.getBoundingClientRect();

      // move camera further back when viewport height increases so objects stay the same size 
      let scale = 0.15;
      let fieldOfView = camera.fov * (Math.PI / 180); // convert fov to radians
      let targetZ = canvasRect.height / (2 * Math.tan(fieldOfView / 2));
      camera.position.set(0, 0, targetZ * scale);
    },
        
    /**
     * Separate click and doubleclick.
     * @see http://stackoverflow.com/questions/6330431/jquery-bind-double-click-and-single-click-separately
     */
    onClick = function(e) {
        // separate click from doubleclick
        doubleClickCounter ++;
        if (doubleClickCounter == 1) {
            doubleClickTimer = setTimeout(function() {
                doubleClickCounter = 0;
                // implement single click behaviour here
            }, doubleClickDelay);
        } else {
            clearTimeout(doubleClickTimer);
            doubleClickCounter = 0;
            // implement double click behaviour here
        }
    },
            
    /**
     * Select the object under the mouse.
     * Start dragging the object.
     */
    onTouchStart = function(e) {
      // update picking ray
      updateMouseRay(e);
      // get intersected processor
      const intersects = raycaster.intersectObjects(allObjects, true);
      let outerObject = null;
      // select first wheel in the intersects
      if (intersects.length) {
        // get topmost parent of closest object
        outerObject = getOuterParentObject(intersects[0]);
        // select the touched processor
        store.dispatch(store.getActions().selectProcessor(outerObject.userData.id));
        dragObjectType = 'processor';
      } else {
        dragObjectType = 'background';
      }
      dragStart(outerObject, mousePoint);
    },
            
    /**
     * Initialise object dragging.
     * @param {object} object3d The Object3D to be dragged.
     */
    dragStart = function(object3d, mousePoint) {
      dragObject = object3d;
      // update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mousePoint, camera);
      // if ray intersects plane, store point in vector 'intersection'
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        switch (dragObjectType) {
          case 'processor':
            // offset is the intersection point minus object position,
            // so distance from object to mouse
            dragOffset.copy(intersection).sub(dragObject.position);
            break;
          case 'background':
            dragOffset = new Vector3();
            intersectionPrevious.copy(intersection);
            break;
        }
        rootEl.style.cursor = 'move';
      }
    },
            
    /**
     * Drag a 3D object.
     * @param  {Object} e Event.
     */
    dragMove = function(e) {
      e.preventDefault();

      // update picking ray.
      updateMouseRay(e);
      switch (dragObjectType) {
        case 'processor':
          if (raycaster.ray.intersectPlane(plane, intersection)) {
            dragObject.position.copy(intersection.sub(dragOffset));
          }
          break;
        case 'background':
          if (raycaster.ray.intersectPlane(plane, intersection)) {
            let current = intersection.clone();
            dragOffset.copy(current.sub(intersectionPrevious));
            intersectionPrevious.copy(intersection);
            allObjects.forEach(object3d => {
              object3d.position.add(dragOffset);
            });
          }
          break;

        // when not dragging
        default:
          var intersects = raycaster.intersectObjects(allObjects, true);
          if (intersects.length > 0) {
            if (intersectedObject != intersects[0].object) {
              intersectedObject = intersects[0].object;
            }
            rootEl.style.cursor = 'pointer';
          } else {
            intersectedObject = null;
            rootEl.style.cursor = 'auto';
          }
      }
    },
            
    /**
     * Dragging 3D object ended.
     * @param  {Object} e Event.
     */
    dragEnd = function(e) {
        e.preventDefault();
        dragObject = null;
        dragObjectType = null;
        rootEl.style.cursor = 'auto';
    },

    /**
     * Set up the 3D world.
     */
    initWorld = function() {

      renderer = new WebGLRenderer({antialias: true});
      renderer.setClearColor(new Color( getThemeColors().colorBackground || '#cccccc' ));

      rootEl = document.querySelector('#canvas-container');
      rootEl.appendChild(renderer.domElement);

      scene = new Scene();

      camera = new PerspectiveCamera(45, 1, 1, 500);
      scene.add(camera);

      const light = new DirectionalLight(0xffffff, 1.5);
      light.position.set(0, 0, 1);
      scene.add(light);

      plane = new Plane();
      plane.setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(plane.normal),
        new Vector3(0,0,0));
      
      lineMaterial = new LineBasicMaterial({
        color: new Color(0x000000),
        linewidth: 3,
      });
    },

    setThemeOnWorld = function() {
      const themeColors = getThemeColors();
      renderer.setClearColor(new Color( themeColors.colorBackground ));
      lineMaterial.color.set( themeColors.colorHigh );
    },
            
    /**
     * Set a raycaster's ray to point from the camera to the mouse postion.
     * @param {event} mouseEvent Event rom which to get the mouse coordinates.
     */
    updateMouseRay = function(mouseEvent) {
        // update mouse vector with mouse coordinated translated to viewport
        mousePoint.x = ((mouseEvent.clientX - canvasRect.left) / canvasRect.width ) * 2 - 1;
        mousePoint.y = - ((mouseEvent.clientY - canvasRect.top) / canvasRect.height ) * 2 + 1;

        // update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mousePoint, camera);
    },
            
    /**
     * Recursive function to get top level object of a group.
     * @param {object} object3d An Three.js Object3D.
     */
    getOuterParentObject = function(object3d) {
      if (object3d.object && object3d.object.parent && object3d.object.parent.type !== 'Scene') {
        return getOuterParentObject(object3d.object.parent);
      } else if (object3d.parent && object3d.parent.type !== 'Scene') {
        return getOuterParentObject(object3d.parent);
      }
      if (object3d.object) {
        return object3d.object;
      }
      return object3d;
    },
        
    /**
     * Create canvas 2D object if it exists for the type.
     * @param  {Array} data Array of current processors' state.
     */
    createProcessorViews = function(state) {
      state.processors.allIds.forEach((id, i) => {
        const processorData = state.processors.byId[id];
        const isExists = allObjects.find(obj3d => obj3d.userData.id === id);
        if (!isExists) {
          import(`../processors/${processorData.type}/object3d.js`)
            .then(module => {
              // create the processor 3d object
              const object3d = module.createObject3d(lineMaterial, getThemeColors().colorHigh, processorData.id);
              allObjects.push(object3d);
              scene.add(object3d);

              // update the picking ray with the camera and mouse position
              const point = {
                x: (processorData.positionX / canvasRect.width ) * 2 - 1,
                y: - (processorData.positionY / canvasRect.height ) * 2 + 1,
              };
              raycaster.setFromCamera(point, camera);
              
              // position the new processor in the scene
              if (raycaster.ray.intersectPlane(plane, intersection)) {
                object3d.position.copy(intersection.sub(dragOffset));
              }

              // create controller for the object
              import(`../processors/${processorData.type}/object3dController.js`)
                .then(module => {
                  const controller = module.createObject3dController({ object3d, processorData, store, });
                  controller.updateSelectCircle(store.getState().selectedID);
                  controllers.push(controller);
                });
            });
        }
      });
    },

    /** 
     * Show the selected state of the processors.
     */
    selectProcessorView = function(state) {
      controllers.forEach(controller => {
        controller.updateSelectCircle(state.selectedID);
      });
    },

    clearProcessorViews = function() {
      // remove all processor 3D objects
      allObjects = allObjects.reduce((accumulator, object3D) => {
        scene.remove(object3D);
        return accumulator;
      }, []);

      // remove all controllers
      controllers = controllers.reduce((accumulator, controller) => {
        controller.terminate();
        return accumulator;
      }, []);
    },
        
    /**
     * Delete canvas 2D object when the processor is deleted.
     * @param  {Object} processor MIDI processor for which the 3D object will be a view.
     */
    deleteProcessorView = function(id) {
      // remove 3D object from allObjects
      allObjects = allObjects.reduce((accumulator, object3D) => {
        if (object3D.userData.id === id) {
          // remove 3D object from scene
          scene.remove(object3D);
          return accumulator;
        }
        return [...accumulator, object3D];
      }, []);

      // remove controller
      controllers = controllers.reduce((accumulator, controller) => {
        if (controller.getID() === id) {
          controller.terminate();
          return accumulator;
        }
        return [...accumulator, controller];
      }, []);
    },
        
    /**
     * Update any tween animations that are going on and
     * redraw the canvases if needed.
     * @param {Number} position Transport playback position in ticks.
     * @param {Array} processorEvents Array to processor generated events to displayin the view.
     */
    draw = function(position, processorEvents) {
      controllers.forEach(controller => controller.draw(position, processorEvents));
      renderer.render(scene, camera);
    };

  my = my || {};
  
  that = addWindowResize(specs, my);

  init();
    
  that.draw = draw;
  return that;
}