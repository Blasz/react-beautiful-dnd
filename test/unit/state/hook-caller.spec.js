// @flow
import createHookCaller from '../../../src/state/hooks/hook-caller';
import type { Hooks, HookCaller } from '../../../src/state/hooks/hooks-types';
import * as state from '../../utils/simple-state-preset';
import { getPreset } from '../../utils/dimension';
import type {
  Announce,
  DropResult,
  State,
  DimensionState,
  DraggableLocation,
  DragStart,
} from '../../../src/types';

const preset = getPreset();

const noDimensions: DimensionState = {
  request: null,
  draggable: {},
  droppable: {},
};

describe('fire hooks', () => {
  let hooks: Hooks;
  let caller: HookCaller;
  const announceMock: Announce = () => { };

  beforeEach(() => {
    caller = createHookCaller(announceMock);
    hooks = {
      onDragStart: jest.fn(),
      onDragEnd: jest.fn(),
    };
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('drag start', () => {
    it('should call the onDragStart hook when a drag starts', () => {
      caller.onStateChange(hooks, state.requesting(), state.dragging());
      const expected: DragStart = {
        draggableId: preset.inHome1.descriptor.id,
        type: preset.home.descriptor.type,
        source: {
          droppableId: preset.inHome1.descriptor.droppableId,
          index: preset.inHome1.descriptor.index,
        },
      };

      expect(hooks.onDragStart).toHaveBeenCalledWith(expected, announceMock);
    });

    it('should do nothing if no onDragStart is not provided', () => {
      const customHooks: Hooks = {
        onDragEnd: jest.fn(),
      };

      caller.onStateChange(customHooks, state.requesting(), state.dragging());

      expect(console.error).not.toHaveBeenCalled();
    });

    it('should log an error and not call the callback if there is no current drag', () => {
      const invalid: State = {
        ...state.dragging(),
        drag: null,
      };

      caller.onStateChange(hooks, state.requesting(), invalid);

      expect(console.error).toHaveBeenCalled();
    });

    it('should not call if only collecting dimensions (not dragging yet)', () => {
      caller.onStateChange(hooks, state.idle, state.preparing);
      caller.onStateChange(hooks, state.preparing, state.requesting());

      expect(hooks.onDragStart).not.toHaveBeenCalled();
    });
  });

  describe('drag end', () => {
    // it is possible to complete a drag from a DRAGGING or DROP_ANIMATING (drop or cancel)
    const preEndStates: State[] = [
      state.dragging(),
      state.dropAnimating(),
      state.userCancel(),
    ];

    preEndStates.forEach((previous: State): void => {
      it('should call onDragEnd with the drop result', () => {
        const result: DropResult = {
          draggableId: preset.inHome1.descriptor.id,
          type: preset.home.descriptor.type,
          source: {
            droppableId: preset.inHome1.descriptor.droppableId,
            index: preset.inHome1.descriptor.index,
          },
          destination: {
            droppableId: preset.inHome1.descriptor.droppableId,
            index: preset.inHome1.descriptor.index + 1,
          },
        };
        const current: State = {
          phase: 'DROP_COMPLETE',
          drop: {
            pending: null,
            result,
          },
          drag: null,
          dimension: noDimensions,
        };

        caller.onStateChange(hooks, previous, current);

        if (!current.drop || !current.drop.result) {
          throw new Error('invalid state');
        }

        const provided: DropResult = current.drop.result;
        expect(hooks.onDragEnd).toHaveBeenCalledWith(provided, announceMock);
      });

      it('should log an error and not call the callback if there is no drop result', () => {
        const invalid: State = {
          ...state.dropComplete(),
          drop: null,
        };

        caller.onStateChange(hooks, previous, invalid);

        expect(hooks.onDragEnd).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
      });

      it('should call onDragEnd with null as the destination if there is no destination', () => {
        const result: DropResult = {
          draggableId: preset.inHome1.descriptor.id,
          type: preset.home.descriptor.type,
          source: {
            droppableId: preset.inHome1.descriptor.droppableId,
            index: preset.inHome1.descriptor.index,
          },
          destination: null,
        };
        const current: State = {
          phase: 'DROP_COMPLETE',
          drop: {
            pending: null,
            result,
          },
          drag: null,
          dimension: noDimensions,
        };

        caller.onStateChange(hooks, previous, current);

        expect(hooks.onDragEnd).toHaveBeenCalledWith(result, announceMock);
      });

      it('should call onDragEnd with null if the item did not move', () => {
        const source: DraggableLocation = {
          droppableId: preset.inHome1.descriptor.droppableId,
          index: preset.inHome1.descriptor.index,
        };
        const result: DropResult = {
          draggableId: preset.inHome1.descriptor.id,
          type: preset.home.descriptor.type,
          source,
          destination: source,
        };
        const current: State = {
          phase: 'DROP_COMPLETE',
          drop: {
            pending: null,
            result,
          },
          drag: null,
          dimension: noDimensions,
        };
        const expected : DropResult = {
          draggableId: result.draggableId,
          type: result.type,
          source: result.source,
          // destination has been cleared
          destination: null,
        };

        caller.onStateChange(hooks, previous, current);

        expect(hooks.onDragEnd).toHaveBeenCalledWith(expected, announceMock);
      });
    });
  });

  describe('drag cleared', () => {
    describe('cleared while dragging', () => {
      it('should return a result with a null destination', () => {
        const expected: DropResult = {
          draggableId: preset.inHome1.descriptor.id,
          type: preset.home.descriptor.type,
          // $ExpectError - not checking for null
          source: {
            index: preset.inHome1.descriptor.index,
            droppableId: preset.inHome1.descriptor.droppableId,
          },
          destination: null,
        };

        caller.onStateChange(hooks, state.dragging(), state.idle);

        expect(hooks.onDragEnd).toHaveBeenCalledWith(expected, announceMock);
      });

      it('should log an error and do nothing if it cannot find a previous drag to publish', () => {
        const invalid: State = {
          phase: 'DRAGGING',
          drag: null,
          drop: null,
          dimension: noDimensions,
        };

        caller.onStateChange(hooks, state.idle, invalid);

        expect(hooks.onDragEnd).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
      });
    });

    // this should never really happen - but just being safe
    describe('cleared while drop animating', () => {
      it('should return a result with a null destination', () => {
        const expected: DropResult = {
          draggableId: preset.inHome1.descriptor.id,
          type: preset.home.descriptor.type,
          source: {
            index: preset.inHome1.descriptor.index,
            droppableId: preset.inHome1.descriptor.droppableId,
          },
          destination: null,
        };

        caller.onStateChange(hooks, state.dropAnimating(), state.idle);

        expect(hooks.onDragEnd).toHaveBeenCalledWith(expected, announceMock);
      });

      it('should log an error and do nothing if it cannot find a previous drag to publish', () => {
        const invalid: State = {
          ...state.dropAnimating(),
          drop: null,
        };

        caller.onStateChange(hooks, invalid, state.idle);

        expect(hooks.onDragEnd).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('phase unchanged', () => {
    it('should not do anything if the previous and next phase are the same', () => {
      Object.keys(state).forEach((key: string) => {
        const current: State = state[key];

        caller.onStateChange(hooks, current, current);

        expect(hooks.onDragStart).not.toHaveBeenCalled();
        expect(hooks.onDragEnd).not.toHaveBeenCalled();
      });
    });
  });
});
