// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Col, Row } from 'antd/lib/grid';

import {
    ActiveControl, NavigationType, ToolsBlockerState, Workspace,
} from 'reducers';
import { Job } from 'cvat-core-wrapper';
import { KeyMap } from 'utils/mousetrap-react';
import LeftGroup from './left-group';
import PlayerButtons from './player-buttons';
import PlayerNavigation from './player-navigation';
import RightGroup from './right-group';

interface Props {
    playing: boolean;
    saving: boolean;
    frameNumber: number;
    frameFilename: string;
    frameDeleted: boolean;
    inputFrameRef: React.RefObject<HTMLInputElement>;
    startFrame: number;
    stopFrame: number;
    undoAction?: string;
    redoAction?: string;
    workspace: Workspace;
    undoShortcut: string;
    redoShortcut: string;
    drawShortcut: string;
    switchToolsBlockerShortcut: string;
    playPauseShortcut: string;
    deleteFrameShortcut: string;
    nextFrameShortcut: string;
    previousFrameShortcut: string;
    forwardShortcut: string;
    backwardShortcut: string;
    navigationType: NavigationType;
    focusFrameInputShortcut: string;
    searchFrameByNameShortcut: string;
    activeControl: ActiveControl;
    toolsBlockerState: ToolsBlockerState;
    annotationFilters: object[];
    initialOpenGuide: boolean;
    showSearchFrameByName: boolean;
    keyMap: KeyMap;
    jobInstance: Job;
    ranges: string;
    changeWorkspace(workspace: Workspace): void;
    showStatistics(): void;
    showFilters(): void;
    onSwitchPlay(): void;
    onPrevFrame(): void;
    onNextFrame(): void;
    onForward(): void;
    onBackward(): void;
    onFirstFrame(): void;
    onLastFrame(): void;
    onSearchAnnotations(direction: 'forward' | 'backward'): void;
    onSliderChange(value: number): void;
    onInputChange(value: number): void;
    onURLIconClick(): void;
    onCopyFilenameIconClick(): void;
    onUndoClick(): void;
    onRedoClick(): void;
    onFinishDraw(): void;
    onSwitchToolsBlockerState(): void;
    onDeleteFrame(): void;
    onRestoreFrame(): void;
    switchNavigationBlocked(blocked: boolean): void;
    setNavigationType(navigationType: NavigationType): void;
    switchShowSearchPallet(visible: boolean): void;
}

export default function AnnotationTopBarComponent(props: Props): JSX.Element {
    const {
        saving,
        undoAction,
        redoAction,
        playing,
        ranges,
        frameNumber,
        frameFilename,
        frameDeleted,
        inputFrameRef,
        startFrame,
        stopFrame,
        workspace,
        undoShortcut,
        redoShortcut,
        drawShortcut,
        switchToolsBlockerShortcut,
        playPauseShortcut,
        deleteFrameShortcut,
        nextFrameShortcut,
        previousFrameShortcut,
        forwardShortcut,
        backwardShortcut,
        focusFrameInputShortcut,
        searchFrameByNameShortcut,
        activeControl,
        toolsBlockerState,
        annotationFilters,
        initialOpenGuide,
        navigationType,
        jobInstance,
        keyMap,
        showStatistics,
        showFilters,
        changeWorkspace,
        onSwitchPlay,
        onPrevFrame,
        onNextFrame,
        onForward,
        onBackward,
        onFirstFrame,
        onLastFrame,
        onSearchAnnotations,
        onSliderChange,
        onInputChange,
        onURLIconClick,
        onCopyFilenameIconClick,
        onUndoClick,
        onRedoClick,
        onFinishDraw,
        onSwitchToolsBlockerState,
        onDeleteFrame,
        onRestoreFrame,
        setNavigationType,
        switchNavigationBlocked,
        switchShowSearchPallet,
        showSearchFrameByName,
    } = props;

    const playerItems: [JSX.Element, number][] = [];

    playerItems.push([(
        <PlayerButtons
            key='player_buttons'
            playing={playing}
            playPauseShortcut={playPauseShortcut}
            nextFrameShortcut={nextFrameShortcut}
            previousFrameShortcut={previousFrameShortcut}
            forwardShortcut={forwardShortcut}
            backwardShortcut={backwardShortcut}
            navigationType={navigationType}
            keyMap={keyMap}
            workspace={workspace}
            onPrevFrame={onPrevFrame}
            onNextFrame={onNextFrame}
            onForward={onForward}
            onBackward={onBackward}
            onFirstFrame={onFirstFrame}
            onLastFrame={onLastFrame}
            onSwitchPlay={onSwitchPlay}
            onSearchAnnotations={onSearchAnnotations}
            setNavigationType={setNavigationType}
        />
    ), 0]);

    playerItems.push([(
        <PlayerNavigation
            key='player_navigation'
            startFrame={startFrame}
            stopFrame={stopFrame}
            playing={playing}
            ranges={ranges}
            frameNumber={frameNumber}
            frameFilename={frameFilename}
            frameDeleted={frameDeleted}
            deleteFrameShortcut={deleteFrameShortcut}
            focusFrameInputShortcut={focusFrameInputShortcut}
            searchFrameByNameShortcut={searchFrameByNameShortcut}
            inputFrameRef={inputFrameRef}
            keyMap={keyMap}
            workspace={workspace}
            onSliderChange={onSliderChange}
            onInputChange={onInputChange}
            onURLIconClick={onURLIconClick}
            onCopyFilenameIconClick={onCopyFilenameIconClick}
            onDeleteFrame={onDeleteFrame}
            onRestoreFrame={onRestoreFrame}
            switchNavigationBlocked={switchNavigationBlocked}
            switchShowSearchPallet={switchShowSearchPallet}
            showSearchFrameByName={showSearchFrameByName}
        />
    ), 10]);

    return (
        <Row justify='space-between'>
            <LeftGroup
                saving={saving}
                undoAction={undoAction}
                redoAction={redoAction}
                undoShortcut={undoShortcut}
                redoShortcut={redoShortcut}
                activeControl={activeControl}
                drawShortcut={drawShortcut}
                switchToolsBlockerShortcut={switchToolsBlockerShortcut}
                toolsBlockerState={toolsBlockerState}
                onUndoClick={onUndoClick}
                onRedoClick={onRedoClick}
                onFinishDraw={onFinishDraw}
                onSwitchToolsBlockerState={onSwitchToolsBlockerState}
                keyMap={keyMap}
            />
            <Col className='cvat-annotation-header-player-group'>
                <Row align='middle'>
                    { playerItems.sort((menuItem1, menuItem2) => menuItem1[1] - menuItem2[1])
                        .map((menuItem) => menuItem[0]) }
                </Row>
            </Col>
            <RightGroup
                workspace={workspace}
                jobInstance={jobInstance}
                annotationFilters={annotationFilters}
                initialOpenGuide={initialOpenGuide}
                changeWorkspace={changeWorkspace}
                showStatistics={showStatistics}
                showFilters={showFilters}
            />
        </Row>
    );
}
