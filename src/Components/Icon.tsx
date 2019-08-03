import React from 'react';
import IconStore from '../Style/Icons.svg';
import {classMap} from "../Views/App";

export const Icon = ({name, className, onClick}: {name: string, className?: string, onClick?(e: React.MouseEvent): any}) => {
  return <span className="icon-cont">
    <svg className={classMap("icon", className)} onClick={onClick}>
      <use href={`${IconStore}#${name}`}/>
    </svg>
  </span>;
};