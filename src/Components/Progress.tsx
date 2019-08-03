import React from "react";
import {classMap} from "../Views/App";

interface ProgressProps {
  position: number,
  className?: string,
  onMouse?(e: React.MouseEvent): any,
  onTouch?(e: React.TouchEvent): any,
  animated?: boolean
}

export const Progress = React.forwardRef(({position, onMouse, onTouch, className, animated}: ProgressProps, ref: any) => (
  <span className={classMap("progress", className)} onClick={onMouse} onMouseDown={onMouse}
        onTouchStart={onTouch} onTouchMove={onTouch} onTouchEnd={onTouch} onTouchCancel={onTouch} ref={ref}>
    <span className={classMap(animated && "animated")} style={{width: `${position}%`}}/>
  </span>
));