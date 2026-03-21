import { MouseSensor, type MouseSensorOptions, TouchSensor } from "@dnd-kit/core";
import type { MouseEvent as ReactMouseEvent } from "react";

export const LONG_PRESS_DELAY_MS = 500;

export class RightClickMouseSensor extends MouseSensor {
  static override activators = [
    {
      eventName: "onMouseDown" as const,
      handler: ({ nativeEvent: event }: ReactMouseEvent, { onActivation }: MouseSensorOptions) => {
        if (event.button !== 2) {
          return false;
        }

        event.preventDefault();
        onActivation?.({ event });
        return true;
      }
    }
  ];
}

export { TouchSensor };