import {
  Geometry,
  Color,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Object3D,
  Shape,
  Vector3,
  Group,
} from '../../lib/three.module.js';
import { getThemeColors } from '../state/selectors.js';
import { createCircleOutline } from './util3d.js';

export default function addConnections3d(specs, my) {
  let that,
    store = specs.store,
    state = {
      sourceProcessorID: null,
      sourceConnectorID: null,
      sourceConnectorPosition: null,
    },
    defaultColor,
    lineMaterial,
    currentCable,
    currentCableDragHandle,
    cablesGroup,
    dragHandleRadius = 1.5,
    
    init = function() {
      currentCableDragHandle = createCircleOutline(lineMaterial, dragHandleRadius);
      currentCableDragHandle.name = 'dragHandle';

      document.addEventListener(store.STATE_CHANGE, (e) => {
        switch (e.detail.action.type) {

          case e.detail.actions.TOGGLE_CONNECT_MODE:
            toggleConnectMode(e.detail.state.connectModeActive);
            // drawConnectCanvas(e.detail.state);
            // drawCables(e.detail.state);
            break;
          
          case e.detail.actions.ADD_PROCESSOR:
          case e.detail.actions.DELETE_PROCESSOR:
          case e.detail.actions.DRAG_SELECTED_PROCESSOR:
          case e.detail.actions.DRAG_ALL_PROCESSORS:
          case e.detail.actions.CONNECT_PROCESSORS:
          case e.detail.actions.DISCONNECT_PROCESSORS:
            // drawConnectCanvas(e.detail.state);
            clearCables();
            drawCables(e.detail.state);
            break;
          
          case e.detail.actions.CREATE_PROJECT:
            setTheme();
            clearCables();
            drawCables(e.detail.state);
            break;
          case e.detail.actions.SET_THEME:
            // createConnectorGraphic();
            setTheme();
            toggleConnectMode(e.detail.state.connectModeActive);
            // drawConnectCanvas(e.detail.state);
            break;
        }
      });
    },
        
    /**
     * Start dragging a connection cable.
     * @param {String} sourceProcessorID
     * @param {String} sourceConnectorID
     * @param {Vector3} sourceConnectorPosition
     */
    dragStartConnection = function(sourceProcessorID, sourceConnectorID, sourceConnectorPosition) {
      state = { ...state, sourceProcessorID, sourceConnectorID, sourceConnectorPosition, };
      currentCable = new Line(new Geometry(), lineMaterial);
      currentCable.name = 'currentCable';
      cablesGroup.add(currentCable);

      currentCableDragHandle.position.copy(sourceConnectorPosition);
      cablesGroup.add(currentCableDragHandle);
    },
        
    /**
     * Drag a connection cable.
     * @param {Vector3} position3d
     */
    dragMoveConnection = function(position3d) {
      const geometry = new Geometry();
      geometry.vertices.push(state.sourceConnectorPosition.clone(), position3d.clone());
      currentCable.geometry.dispose();
      currentCable.geometry = geometry;

      currentCableDragHandle.position.copy(position3d);
    },

    dragEndConnection = function() {
      currentCable.geometry.dispose();
      currentCable.geometry = new Geometry();
      cablesGroup.remove(currentCable);
      cablesGroup.remove(currentCableDragHandle);
    },

    createConnection = function(destinationProcessorID, destinationConnectorID) {
      store.dispatch(store.getActions().connectProcessors({
        sourceProcessorID: state.sourceProcessorID, 
        sourceConnectorID: state.sourceConnectorID,
        destinationProcessorID: destinationProcessorID,
        destinationConnectorID: destinationConnectorID,
      }));
      state.sourceProcessorID = null;
      state.sourceConnectorID = null;
    },

    clearCables = function() {
      if (cablesGroup) {
        while (cablesGroup.children.length) {
          cablesGroup.remove(cablesGroup.children[0]);
        }
      }
    },

    drawCables = function(state) {
      if (!cablesGroup) {
        cablesGroup = new Group();
        my.scene.add(cablesGroup);
      }
      
      state.connections.allIds.forEach(connectionID => {
        const connection = state.connections.byId[connectionID];
        const sourceProcessor = state.processors.byId[connection.sourceProcessorID];
        const destinationProcessor = state.processors.byId[connection.destinationProcessorID];

        if (sourceProcessor && destinationProcessor) {
          const sourceConnector = sourceProcessor.outputs.byId[connection.sourceConnectorID];
          const destinationConnector = destinationProcessor.inputs.byId[connection.destinationConnectorID];

          const sourcePosition = new Vector3(
            sourceProcessor.positionX + sourceConnector.x,
            sourceProcessor.positionY + sourceConnector.y,
            sourceProcessor.positionZ + sourceConnector.z,
          );
          const destinationPosition = new Vector3(
            destinationProcessor.positionX + destinationConnector.x,
            destinationProcessor.positionY + destinationConnector.y,
            destinationProcessor.positionZ + destinationConnector.z,
          );
          
          drawCable(sourcePosition, destinationPosition);
          
          // cableData.byId[connectionID] = {
          //     handleX: handlePosition.x,
          //     handleY: handlePosition.y
          // };
          // cableData.allIds.push(connectionID);
        }
      });
    },

    /**
     * Enter or leave application connect mode.
     * @param {Vector3} sourcePosition Cable start position.
     * @param {Vector3} destinationPosition Cable end position.
     */
    drawCable = function(sourcePosition, destinationPosition) {
      const geometry = new Geometry();
      geometry.vertices.push(sourcePosition, destinationPosition);
      const cable = new Line(geometry, lineMaterial);
      cablesGroup.add(cable);
    },

    /**
     * Enter or leave application connect mode.
     * @param {Boolean} isEnabled True to enable connect mode.
     */
    toggleConnectMode = function(isEnabled) {
        my.isConnectMode = isEnabled;
    },
    
    setTheme = function() {
      defaultColor = getThemeColors().colorHigh;
      lineMaterial = new LineBasicMaterial({
        color: defaultColor,
      });
      currentCableDragHandle.material.color.set( defaultColor );
    };

  my = my || {};
  my.isConnectMode = false,
  // my.resizeConnections = resizeConnections;
  my.dragStartConnection = dragStartConnection;
  my.dragMoveConnection = dragMoveConnection;
  my.dragEndConnection = dragEndConnection;
  my.createConnection = createConnection;
  // my.intersectsConnector = intersectsConnector;
  // my.intersectsCableHandle = intersectsCableHandle;
  // my.addConnectionsToCanvas = addConnectionsToCanvas;
  
  that = specs.that || {};
  
  init();
  
  return that;
}