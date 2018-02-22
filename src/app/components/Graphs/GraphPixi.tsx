import * as React from 'react';
import {connect, Dispatch} from 'react-redux';
import * as d3 from 'd3';
import { concat, debounce, remove, includes, assign, isEqual, isEmpty, isEqualWith } from 'lodash';
import { nodesSelect, highlightNodes, deselectNodes, showTooltip, setSelectingMode } from '../../modules/graph/actions.js';
import { getArcParams, getDirectlyRelatedNodes } from '../../helpers/index.js';
import * as PIXI from 'pixi.js';
import {Search} from "../../interfaces/search";
import {Node} from "../../interfaces/node";
import {Link} from "../../interfaces/link";
import {NodeFromWorker} from "../../interfaces/nodeFromWorker";
import {LinkFromWorker} from "../../interfaces/linkFromWorker";
const myWorker = require("worker-loader!./Worker");

interface TextureMap {
    [hash: string]: PIXI.RenderTexture;
}

interface Props {
    selectingMode: boolean;
    searches: Search[];
    nodes: Node[];
    links: Link[];
    tooltipNodes: Node[];
    highlightNodes: Node[];
    zoomEvents: any;
    dispatch: Dispatch<any>;
    version: string;
}

interface State {
    nodesForDisplay: Node[];
    linksForDisplay: Link[];
    nodesFromWorker: NodeFromWorker[];
    nodeTextures: TextureMap;
    renderedNodesContainer: PIXI.Container;
    linksFromWorker: LinkFromWorker[];
    renderedLinks: PIXI.Graphics;
    renderedLinkLabels: PIXI.Container;
    selection: any;
    renderedSelection: PIXI.Graphics;
    renderer: PIXI.WebGLRenderer;
    renderedTooltip: PIXI.Container;
    renderedSelectedNodes: PIXI.Container;
    selectedNodeTextures: TextureMap;
    searchResultTextures: TextureMap;
    renderedSearchResults: PIXI.Container;
    stage: PIXI.Container;
    worker: Worker;
    renderedSinceLastTick: boolean;
    renderedSinceLastZoom: boolean;
    renderedSinceLastTooltip: boolean;
    renderedSinceLastSelection: boolean;
    renderedSinceLastSelectedNodes: boolean;
    renderedSinceLastQueries: boolean;
    renderedSinceLastSearchResults: boolean;
    transform: any; // d3.ZoomTransform gives error saying that 'k' is readonly
    shift: boolean;
    lastLoopTimestamp: number;
    frameTime: number;
    lastDisplayedFps: Date;
    labelTextures: TextureMap;
    tooltipTextures: TextureMap;
}

class GraphPixi extends React.Component<Props, State> {
    pixiContainer: HTMLElement;
    state: State = {
        nodesForDisplay: [],
        linksForDisplay: [],
        nodesFromWorker: [],
        nodeTextures: {},
        renderedNodesContainer: undefined,
        linksFromWorker: [],
        renderedLinks: undefined,
        renderedLinkLabels: undefined,
        selection: null,
        renderedSelection: undefined,
        renderer: undefined,
        renderedTooltip: undefined,
        renderedSelectedNodes: undefined,
        selectedNodeTextures: {},
        searchResultTextures: {},
        renderedSearchResults: undefined,
        stage: undefined,
        worker: undefined,
        renderedSinceLastTick: false,
        renderedSinceLastZoom: true,
        renderedSinceLastTooltip: false,
        renderedSinceLastSelection: false,
        renderedSinceLastSelectedNodes: false,
        renderedSinceLastQueries: false,
        renderedSinceLastSearchResults: true,
        transform: d3.zoomIdentity as any,
        shift: false,
        lastLoopTimestamp: 0,
        frameTime: 0,
        lastDisplayedFps: new Date(),
        labelTextures: {},
        tooltipTextures: {}
    };

    isMoving() {
        const { selectingMode } = this.props;

        return !selectingMode;
    }

    postWorkerMessage(message) {
        const { worker } = this.state;

        worker.postMessage(message);
    }

    onWorkerMessage(event) {
        switch (event.data.type) {
            case 'tick':
                this.onWorkerTick(event.data);
                break;
            case 'end':
                // this.ended(event.data);
                break;
        }
    }

    onWorkerTick(data) {
        data.nodes.forEach(node => {
            node.textureKey = this.getNodeTextureKey(node);
        });

        this.setState({
            nodesFromWorker: data.nodes,
            linksFromWorker: data.links,
            renderedSinceLastTick: false
        });
    }

    zoom(fraction: number, newX: number, newY: number) {
        const { renderedNodesContainer, renderedLinks, renderedSelectedNodes, renderedLinkLabels, renderedSearchResults } = this.state;

        [renderedNodesContainer, renderedLinks, renderedSelectedNodes, renderedLinkLabels, renderedSearchResults].forEach(zoomable => {
            zoomable.scale.x = fraction;
            zoomable.scale.y = fraction;

            if (typeof newX !== 'undefined') {
                zoomable.position.x = newX;
            }

            if (typeof newY !== 'undefined') {
                zoomable.position.y = newY;
            }
        });

        this.setState({
            renderedSinceLastZoom: false
        });
    }

    zoomed() {
        const transform = d3.event.transform;

        this.zoom(transform.k, transform.x, transform.y);

        this.setState({
            transform: transform,
        });
    }

    getQueryColor(query: string) {
        const { searches } = this.props;
        const search = searches.find(search => search.q === query);

        if (typeof search !== 'undefined') {
            return search.color;
        }
    }

    getNodeTextureKey(node: NodeFromWorker) {
        return node.icon
            + node.r
            + node.queries.map(query => this.getQueryColor(query)).join('');
    }

    getNodeTexture(node: NodeFromWorker) {
        const { nodeTextures } = this.state;

        let texture = nodeTextures[node.textureKey];

        if (typeof texture !== 'undefined') {
            return texture;
        }

        const canvas = document.createElement('canvas');
        canvas.width = node.r * 2;
        canvas.height = node.r * 2;
        const ctx = canvas.getContext('2d');

        const fractionPerQuery = 1 / node.queries.length;
        const anglePerQuery = 2 * Math.PI * fractionPerQuery;
        let currentAngle = .5 * Math.PI;

        node.queries.forEach(query => {
            ctx.beginPath();
            ctx.fillStyle = this.getQueryColor(query);
            ctx.moveTo(node.r, node.r);
            ctx.arc(node.r, node.r, node.r, currentAngle, currentAngle + anglePerQuery);
            ctx.fill();

            currentAngle += anglePerQuery;
        });

        ctx.fillStyle = '#ffffff';
        ctx.font = 'italic 12px Roboto, Helvetica, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(node.icon, node.r - 1, node.r + 5);

        texture = PIXI.Texture.fromCanvas(canvas) as PIXI.RenderTexture;

        this.setState(prevState => ({
            nodeTextures: {
                ...prevState.nodeTextures,
                [node.textureKey]: texture
            }
        }));

        return texture;
    }

    renderNodes() {
        const { renderedNodesContainer, nodesFromWorker } = this.state;

        renderedNodesContainer.removeChildren();

        nodesFromWorker.forEach(node => {
            const texture = this.getNodeTexture(node);
            const renderedNode = new PIXI.Sprite(texture);

            renderedNode.anchor.x = 0.5;
            renderedNode.anchor.y = 0.5;
            renderedNode.x = node.x;
            renderedNode.y = node.y;

            renderedNodesContainer.addChild(renderedNode);
        });
    }

    renderLinks() {
        const { linksFromWorker, renderedLinks, renderedLinkLabels } = this.state;

        renderedLinks.clear();
        renderedLinkLabels.removeChildren();
        renderedLinks.lineStyle(1, 0xFFFFFF);

        linksFromWorker.forEach(link => {
            this.renderLink(link);
        });
    }

    renderLink(link: LinkFromWorker) {
        if (link.total <= 1) {
            // When there's only 1 link between 2 nodes, we can draw a straight line

            this.renderStraightLine(
                link.source.x,
                link.source.y,
                link.target.x,
                link.target.y
            );

            if (link.label) {
                this.renderTextAlongStraightLine(
                    link.label,
                    link.source.x,
                    link.source.y,
                    link.target.x,
                    link.target.y
                );
            }
        } else {
            // When there are multiple links between 2 nodes, we need to draw arcs

            // Bend only increases per 2 new links
            let bend = (link.current + (link.current % 2)) / 15;

            // Every second link will be drawn on the bottom instead of the top
            if (link.current % 2 === 0) {
                bend = bend * -1;
            }

            const {centerX, centerY, radius, startAngle, endAngle} =
                getArcParams(
                    link.source.x,
                    link.source.y,
                    link.target.x,
                    link.target.y,
                    bend
                );

            this.renderArc(centerX, centerY, radius, startAngle, endAngle, bend < 0);

            if (link.label) {
                const averageAngle = (startAngle + endAngle) / 2;

                this.renderTextAlongArc(link.label, centerX, centerY, radius, averageAngle, 7);
            }
        }
    }

    renderStraightLine(x1: number, y1: number, x2: number, y2: number) {
        const { renderedLinks } = this.state;

        renderedLinks.moveTo(x1, y1);
        renderedLinks.lineTo(x2, y2);
    }

    renderArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number, antiClockwise: boolean) {
        const { renderedLinks } = this.state;

        const xStart = centerX + radius * Math.cos(startAngle);
        const yStart = centerY + radius * Math.sin(startAngle);

        renderedLinks.moveTo(xStart, yStart);
        renderedLinks.arc(centerX, centerY, radius, startAngle, endAngle, antiClockwise);
    }

    renderTextAlongStraightLine(string: string, x1: number, y1: number, x2: number, y2: number) {
        const { renderedLinkLabels } = this.state;

        const texture = this.getLabelTexture(string);
        const text = new PIXI.Sprite(texture);
        const averageX = (x1 + x2) / 2;
        const averageY = (y1 + y2) / 2;
        const deltaX = x1 - x2;
        const deltaY = y1 - y2;
        let angle = Math.atan2(deltaY, deltaX);
        const upsideDown = angle < -1.6 || angle > 1.6;

        text.anchor.set(0.5, 1);

        if (upsideDown) {
            angle += Math.PI;
        }

        text.setTransform(averageX, averageY, 1, 1, angle);

        renderedLinkLabels.addChild(text);
    }

    getLabelTexture(label: string) {
        const { labelTextures, renderer } = this.state;
        let texture = labelTextures[label];

        if (typeof texture !== 'undefined') {
            return texture;
        }

        const style = new PIXI.TextStyle({
            fontSize: 14,
            fill: 0xffffff
        });

        const text = new PIXI.Text(label, style);
        const metrics = PIXI.TextMetrics.measureText(label, style);

        texture = PIXI.RenderTexture.create(metrics.width, metrics.height);
        renderer.render(text, texture);

        this.setState(state => ({
            labelTextures: {
                ...labelTextures,
                [label]: texture
            }
        }));

        return texture;
    }

    getRopeCoordinates(startAngle: number, endAngle: number, radius: number) {
        const num = 10;
        const perIteration = (endAngle - startAngle) / num;
        let currentAngle = startAngle;
        const coordinates = [];

        while ((currentAngle - .0001) < endAngle) {
            const x = radius * Math.cos(currentAngle);
            const y = radius * Math.sin(currentAngle);

            coordinates.push(new PIXI.Point(x, y));

            currentAngle += perIteration;
        }

        return coordinates;
    }

    renderTextAlongArc(string: any, centerX: number, centerY: number, radius: number, angle: number, distanceFromArc: number) {
        const { renderedLinkLabels } = this.state;
        radius += distanceFromArc;

        if (typeof string !== 'string') {
            // typecast to string
            string += '';
        }

        const texture = this.getLabelTexture(string);
        const totalAngle = texture.width / radius;
        const coordinates = this.getRopeCoordinates(angle - totalAngle / 2, angle + totalAngle / 2, radius);
        const rope = new PIXI.mesh.Rope(texture, coordinates);

        rope.x = centerX;
        rope.y = centerY;

        renderedLinkLabels.addChild(rope);
    }

    getSelectedNodes() {
        const { nodes } = this.props;

        return nodes.filter(node => node.selected);
    }

    shouldPostToWorker(prevNodes: Node[], nextNodes: Node[]): boolean {
        return prevNodes.length !== nextNodes.length;

        // Todo: make this more intelligent than only looking at array length
        // Can the graph also change when properties of the nodes change?
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        const { nodes, links, tooltipNodes, searches, highlightNodes } = this.props;
        const { nodesForDisplay } = this.state;
        const selectedNodes = this.getSelectedNodes();
        const prevSelected = prevProps.nodes.filter(node => node.selected);

        if (!isEqual(prevProps.nodes, nodes)) {
            this.setState({
                nodesForDisplay: nodes.filter(node => node.display),
                linksForDisplay: links.filter(link => link.display)
            });
        }

        if (!isEqual(prevSelected, selectedNodes)) {
            this.setState({
                renderedSinceLastSelectedNodes: false
            });
        }

        if (!isEqual(prevProps.tooltipNodes, tooltipNodes)) {
            this.setState({
                renderedSinceLastTooltip: false
            });
        }

        if (!isEqual(prevProps.searches, searches)) {
            this.setState({
                renderedSinceLastQueries: false,
                nodeTextures: {}
            });
        }

        if (this.shouldPostToWorker(prevState.nodesForDisplay, nodesForDisplay)) {
            this.postNodesAndLinksToWorker();
        }

        if (!isEqual(prevProps.highlightNodes, highlightNodes)) {
            this.setState({
                renderedSinceLastSearchResults: false
            });
        }

        this.setState({
            lastDisplayedFps: new Date()
        });
    }

    postNodesAndLinksToWorker() {
        const { nodesForDisplay, linksForDisplay } = this.state;
        const nodesToPost = [];

        nodesForDisplay.forEach(node => {
            nodesToPost.push({
                id: node.id,
                count: node.count,
                hash: node.hash,
                queries: node.queries,
                icon: node.icon
            });
        });

        const linksToPost = [];

        linksForDisplay.forEach(link => {
            linksToPost.push({
                source: link.source,
                target: link.target,
                label: link.label,
                total: link.total,
                current: link.current
            });
        });

        this.postWorkerMessage({
            type: 'update',
            nodes: nodesToPost,
            links: linksToPost
        });
    }

    shouldComponentUpdate(nextProps: Props, nextState: State) {
        const { tooltipNodes, searches, highlightNodes, nodes } = this.props;
        const { lastDisplayedFps, nodesForDisplay } = this.state;
        const selectedNodes = this.getSelectedNodes();
        const nextSelected = nextProps.nodes.filter(node => node.selected);

        return nextProps.nodes !== nodes
            || nextState.nodesForDisplay !== nodesForDisplay
            || !isEqual(nextProps.tooltipNodes, tooltipNodes)
            || !isEqual(nextProps.searches, searches)
            || !isEqual(nextSelected, selectedNodes)
            || !isEqual(nextProps.highlightNodes, highlightNodes)
            || (Date.now() - lastDisplayedFps.getTime()) > 1000;
    }

    renderSelection() {
        const { selection, renderedSelection, transform } = this.state;

        renderedSelection.clear();

        if (selection) {
            const x1 = transform.applyX(selection.x1);
            const x2 = transform.applyX(selection.x2);
            const y1 = transform.applyY(selection.y1);
            const y2 = transform.applyY(selection.y2);
            const width = x2 - x1;
            const height = y2 - y1;

            renderedSelection.beginFill(0xFFFFFF, .1);
            renderedSelection.drawRect(
                x1,
                y1,
                width,
                height
            );
            renderedSelection.endFill();
        }
    }

    getTooltipTexture(node: Node) {
        const { tooltipTextures, renderer } = this.state;

        const key = node.name + node.fields.join('');
        let texture = tooltipTextures[key];

        if (typeof texture !== 'undefined') {
            return texture;
        }

        const container = new PIXI.Container();
        const description = node.fields.join(', ') + ': ' + node.abbreviated;
        const text = new PIXI.Text(description, {
            fontFamily: 'Arial',
            fontSize: '12px',
            fill: '#ffffff'
        });

        text.x = 10;
        text.y = 5;

        const backgroundWidth = text.width + 20;
        const backgroundHeight = text.height + 10;
        const background = new PIXI.Graphics();
        background.beginFill(0x35394d, 1);
        background.lineStyle(1, 0x323447, 1);
        background.drawRoundedRect(0, 0, backgroundWidth, backgroundHeight, 14);

        container.addChild(background);
        container.addChild(text);

        texture = PIXI.RenderTexture.create(backgroundWidth, backgroundHeight);
        renderer.render(container, texture);

        this.setState({
            tooltipTextures: {
                [key]: texture
            }
        });

        return texture;
    }

    renderTooltip() {
        const { renderedTooltip, nodesFromWorker, transform } = this.state;
        const { tooltipNodes } = this.props;

        renderedTooltip.removeChildren();

        if (tooltipNodes.length === 0) {
            return;
        }

        tooltipNodes.forEach(node => {
            const nodeFromWorker = nodesFromWorker.find(search => search.hash === node.hash);

            if (typeof nodeFromWorker === 'undefined') {
                return;
            }

            const texture = this.getTooltipTexture(node);
            const sprite = new PIXI.Sprite(texture);

            sprite.x = transform.applyX(nodeFromWorker.x);
            sprite.y = transform.applyY(nodeFromWorker.y);

            renderedTooltip.addChild(sprite);
        });
    }

    getSelectedNodeTexture(radius: number) {
        const { selectedNodeTextures } = this.state;
        let texture = selectedNodeTextures[radius];

        if (texture) {
            return texture;
        }

        const canvas = document.createElement('canvas');
        canvas.width = radius * 2 + 4;
        canvas.height = radius * 2 + 4;

        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fac04b';
        ctx.arc(radius + 2, radius + 2, radius, 0, 2 * Math.PI);
        ctx.stroke();

        texture = PIXI.Texture.fromCanvas(canvas) as PIXI.RenderTexture;

        this.setState(prevState => ({
            selectedNodeTextures: {
                ...prevState.selectedNodeTextures,
                [radius]: texture
            }
        }));

        return texture;
    }

    /**
     * Draws a border around selected nodes
     */
    renderSelectedNodes() {
        const { nodesFromWorker, renderedSelectedNodes } = this.state;
        const selectedNodes = this.getSelectedNodes();

        renderedSelectedNodes.removeChildren();

        selectedNodes.forEach(selected => {
            const nodeFromWorker = nodesFromWorker.find(search => search.hash === selected.hash);

            if (typeof nodeFromWorker === 'undefined') {
                return;
            }

            const texture = this.getSelectedNodeTexture(nodeFromWorker.r);
            const sprite = new PIXI.Sprite(texture);

            sprite.anchor.x = 0.5;
            sprite.anchor.y = 0.5;
            sprite.x = nodeFromWorker.x;
            sprite.y = nodeFromWorker.y;

            renderedSelectedNodes.addChild(sprite);
        });
    }

    getSearchResultTexture(radius: number) {
        const { searchResultTextures } = this.state;
        radius += 5;
        let texture = searchResultTextures[radius];

        if (texture) {
            return texture;
        }

        const canvas = document.createElement('canvas');
        canvas.width = radius * 2;
        canvas.height = radius * 2;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.arc(radius, radius, radius, 0, 2 * Math.PI);
        ctx.fill();

        texture = PIXI.Texture.fromCanvas(canvas) as PIXI.RenderTexture;

        this.setState(prevState => ({
            searchResultTextures: {
                ...prevState.searchResultTextures,
                [radius]: texture
            }
        }));

        return texture;
    }

    renderSearchResults() {
        const { highlightNodes } = this.props;
        const { nodesFromWorker, renderedSearchResults } = this.state;

        renderedSearchResults.removeChildren();

        highlightNodes.forEach(searchResult => {
            const nodeFromWorker = nodesFromWorker.find(search => search.hash === searchResult.hash);

            if (typeof nodeFromWorker === 'undefined') {
                return;
            }

            const texture = this.getSearchResultTexture(nodeFromWorker.r);
            const sprite = new PIXI.Sprite(texture);

            sprite.anchor.x = 0.5;
            sprite.anchor.y = 0.5;
            sprite.x = nodeFromWorker.x;
            sprite.y = nodeFromWorker.y;

            renderedSearchResults.addChild(sprite);
        });
    }

    renderGraph(renderStage: boolean) {
        const { renderer, stage } = this.state;

        if (renderStage) {
            renderer.render(stage);
        }

        const shouldRender = (key) => {
            return !this.state[key];
        };

        const stateUpdates: any = {};

        if (shouldRender('renderedSinceLastTick')
            || shouldRender('renderedSinceLastZoom')
            || shouldRender('renderedSinceLastQueries')) {
            this.renderNodes();
            this.renderLinks();
            this.renderTooltip();

            stateUpdates.renderedSinceLastTick = true;
            stateUpdates.renderedSinceLastZoom = true;
            stateUpdates.renderedSinceLastQueries = true;
        }

        if (shouldRender('renderedSinceLastSelection')) {
            this.renderSelection();

            stateUpdates.renderedSinceLastSelection = true;
        }

        if (shouldRender('renderedSinceLastTooltip')) {
            this.renderTooltip();

            stateUpdates.renderedSinceLastTooltip = true;
        }

        if (shouldRender('renderedSinceLastSelectedNodes')
            || shouldRender('renderedSinceLastTick')
            || shouldRender('renderedSinceLastZoom')) {
            this.renderSelectedNodes();

            stateUpdates.renderedSinceLastSelectedNodes = true;
        }

        if (shouldRender('renderedSinceLastSearchResults')
            || shouldRender('renderedSinceLastZoom')
            || shouldRender('renderedSinceLastTick')) {
            this.renderSearchResults();

            stateUpdates.renderedSinceLastSearchResults = true;
        }

        this.setState(stateUpdates);
        this.measureFps();

        requestAnimationFrame(() => this.renderGraph(!isEmpty(stateUpdates)));
    }

    measureFps() {
        const { lastLoopTimestamp, frameTime } = this.state;

        const filterStrength = 20;
        const thisLoopTimestamp = (new Date()).getTime();
        const thisFrameTime = thisLoopTimestamp - lastLoopTimestamp;
        const newFrameTime = frameTime + (thisFrameTime - frameTime) / filterStrength;

        this.setState({
            lastLoopTimestamp: thisLoopTimestamp,
            frameTime: newFrameTime
        });
    }

    initGraph() {
        const { width, height } = this.pixiContainer.getBoundingClientRect();

        const renderer = new PIXI.WebGLRenderer({
            antialias: true,
            transparent: false,
            resolution: 1,
            width: width,
            height: height
        });

        renderer.backgroundColor = 0x3D4B5D;

        this.pixiContainer.appendChild(renderer.view);

        const stage = new PIXI.Container();

        const renderedLinks =  new PIXI.Graphics();
        stage.addChild(renderedLinks);

        const renderedLinkLabels =  new PIXI.Container();
        stage.addChild(renderedLinkLabels);

        const renderedSearchResults =  new PIXI.Container();
        stage.addChild(renderedSearchResults);

        const renderedNodesContainer = new PIXI.Container();
        stage.addChild(renderedNodesContainer);

        const renderedSelection = new PIXI.Graphics();
        stage.addChild(renderedSelection);

        const renderedSelectedNodes = new PIXI.Container();
        stage.addChild(renderedSelectedNodes);

        const renderedTooltip = new PIXI.Container();
        stage.addChild(renderedTooltip);

        const dragging = d3.drag()
            .filter(() => this.isMoving())
            .container(renderer.view)
            .subject(this.dragsubject.bind(this))
            .on('start', this.dragstarted.bind(this))
            .on('drag', this.dragged.bind(this))
            .on('end', this.dragended.bind(this));

        const zooming = d3.zoom()
            .filter(() => this.isMoving())
            .scaleExtent([.3, 3])
            .on("zoom", this.zoomed.bind(this));

        d3.select(renderer.view)
            .call(dragging)
            .call(zooming)
            .on('mousedown', this.onMouseDown.bind(this))
            .on('mousemove', this.onMouseMove.bind(this))
            .on('mouseup', this.onMouseUp.bind(this));

        this.setState({
            renderedNodesContainer: renderedNodesContainer,
            renderedLinks: renderedLinks,
            renderedSelection: renderedSelection,
            renderer: renderer,
            renderedTooltip: renderedTooltip,
            stage: stage,
            renderedLinkLabels: renderedLinkLabels,
            renderedSelectedNodes: renderedSelectedNodes,
            renderedSearchResults: renderedSearchResults
        }, () => this.renderGraph(false));
    }

    initWorker() {
        const { width, height } = this.pixiContainer.getBoundingClientRect();
        const { nodes, links } = this.props;
        const worker = new myWorker();

        this.setState({
            worker: worker,
            nodesForDisplay: nodes.filter(node => node.display),
            linksForDisplay: links.filter(link => link.display),
        }, () => {
            worker.onmessage = (event) => this.onWorkerMessage(event);

            this.postWorkerMessage({
                type: 'init',
                clientWidth: width,
                clientHeight: height
            });

            this.postNodesAndLinksToWorker();
        });
    }

    componentDidMount() {
        const { zoomEvents } = this.props;

        this.initWorker();
        this.initGraph();

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        zoomEvents.addListener('zoomIn', this.zoomIn.bind(this));
        zoomEvents.addListener('zoomOut', this.zoomOut.bind(this));
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        document.removeEventListener('keyup', this.handleKeyUp.bind(this));
        window.removeEventListener('resize', this.handleWindowResize.bind(this));
    }

    handleWindowResize = debounce(() => {
        const { renderer } = this.state;
        const { width, height } = this.pixiContainer.getBoundingClientRect();

        renderer.resize(width, height);

        this.setState({
            renderedSinceLastZoom: false
        });
    }, 500);

    dragstarted() {
        const { transform } = this.state;

        const x = transform.invertX(d3.event.sourceEvent.layerX);
        const y = transform.invertY(d3.event.sourceEvent.layerY);

        d3.event.subject.fx = (x);
        d3.event.subject.fy = (y);

        this.postWorkerMessage({
            nodes: [d3.event.subject],
            type: 'restart'
        });

        // Remove the tooltip
        this.tooltipNode(undefined);
    }

    dragged() {
        const { transform } = this.state;

        const x = transform.invertX(d3.event.sourceEvent.layerX);
        const y = transform.invertY(d3.event.sourceEvent.layerY);

        d3.event.subject.fx = (x);
        d3.event.subject.fy = (y);

        this.postWorkerMessage({
            nodes: [d3.event.subject],
            type: 'restart'
        });
    }

    dragended() {
        this.postWorkerMessage({
            nodes: [d3.event.subject],
            type: 'stop'
        });
    }

    dragsubject() {
        const { transform } = this.state;

        const x = transform.invertX(d3.event.x);
        const y = transform.invertY(d3.event.y);

        return this.findNodeFromWorker(x, y);
    }

    findNodeFromWorker(x: number, y: number) {
        const { nodesFromWorker } = this.state;

        return nodesFromWorker.find(node => {
            const dx = x - node.x;
            const dy = y - node.y;
            const d2 = dx * dx + dy * dy;

            return d2 < (node.r * node.r);
        });
    }

    findNode(x, y) {
        const nodeFromWorker = this.findNodeFromWorker(x, y);

        if (typeof nodeFromWorker === 'undefined') {
            return;
        }

        const { nodesForDisplay } = this.state;

        return nodesForDisplay.find(node => node.hash === nodeFromWorker.hash);
    }

    tooltipNode(node: Node) {
        const { tooltipNodes, dispatch } = this.props;

        if (typeof node === 'undefined' && !isEmpty(tooltipNodes)) {
            dispatch(showTooltip([]));
            return;
        }

        if (typeof node !== 'undefined') {
            const current = tooltipNodes.find(search => search.hash === node.hash);

            if (typeof current === 'undefined') {
                dispatch(showTooltip([node]));
            }
        }
    }

    selectNodes(nodes: Node[]) {
        const { dispatch } = this.props;

        dispatch(nodesSelect(nodes));

        this.setState({ renderedSinceLastSelectedNodes: false });
    }

    /**
     * Handles selecting/deselecting nodes.
     * Is not involved with dragging nodes, d3 handles that.
     */
    onMouseDown() {
        const { shift, transform, nodesForDisplay } = this.state;
        const { dispatch, selectingMode } = this.props;
        const selectedNodes = this.getSelectedNodes();

        if (!selectingMode) {
            return;
        }

        if (!shift) {
            dispatch(deselectNodes(selectedNodes));
        }

        const x = transform.invertX(d3.event.layerX);
        const y = transform.invertY(d3.event.layerY);
        const nodeFromWorker = this.findNodeFromWorker(x, y);

        if (nodeFromWorker) {
            const node = nodesForDisplay.find(search => search.hash === nodeFromWorker.hash);
            const selectedNodesCopy = concat(selectedNodes, []);

            if (!includes(selectedNodes, node)) {
                selectedNodesCopy.push(node);
            } else {
                remove(selectedNodesCopy, node);
            }

            this.selectNodes(selectedNodesCopy);
        } else {
            const selection = {x1: x, y1: y, x2: x, y2: y};

            this.setState({ selection: selection });
        }
    }

    onMouseMove() {
        const { transform, selection, nodesForDisplay, linksForDisplay } = this.state;
        const { selectingMode, dispatch, tooltipNodes } = this.props;

        const x = transform.invertX(d3.event.layerX);
        const y = transform.invertY(d3.event.layerY);

        if (selectingMode && selection) {
            const newSelection = assign({}, selection, {
                x2: x,
                y2: y
            });

            this.setState({
                renderedSinceLastSelection: false,
                selection: newSelection
            });
        }

        const tooltip = this.findNode(x, y);

        if (tooltipNodes[0] === tooltip) {
            // Nothing changed
            return;
        }

        this.tooltipNode(tooltip);
        let related = [];

        if (tooltip) {
            related = getDirectlyRelatedNodes([tooltip], nodesForDisplay, linksForDisplay);
        }

        dispatch(highlightNodes(related));
    }

    onMouseUp() {
        const { selection, nodesFromWorker, nodesForDisplay } = this.state;
        const selectedNodes = this.getSelectedNodes();

        if (!selection) {
            return;
        }

        const newSelectedNodes = concat(selectedNodes, []);

        nodesFromWorker.forEach(nodeFromWorker => {
            if ((nodeFromWorker.x > selection.x1 && nodeFromWorker.x < selection.x2) &&
                (nodeFromWorker.y > selection.y1 && nodeFromWorker.y < selection.y2)) {
                const node = nodesForDisplay.find(search => search.hash === nodeFromWorker.hash);

                if (!includes(selectedNodes, node)) {
                    newSelectedNodes.push(node);
                }
            }

            if ((nodeFromWorker.x > selection.x2 && nodeFromWorker.x < selection.x1) &&
                (nodeFromWorker.y > selection.y2 && nodeFromWorker.y < selection.y1)) {
                const node = nodesForDisplay.find(search => search.hash === nodeFromWorker.hash);

                if (!includes(selectedNodes, node)) {
                    newSelectedNodes.push(node);
                }
            }
        });

        this.selectNodes(newSelectedNodes);

        this.setState({
            selection: null,
            renderedSinceLastSelection: false
        });
    }

    handleKeyDown(event) {
        const { selectingMode, dispatch } = this.props;
        const altKey = 18;
        const shiftKey = 16;

        if (event.keyCode === altKey) {
            dispatch(setSelectingMode(!selectingMode));
        } else if (event.keyCode === shiftKey) {
            this.setState({ shift: true });
        }
    }

    handleKeyUp(event) {
        const shiftKey = 16;

        if (event.keyCode === shiftKey) {
            this.setState({ shift: false });
        }
    }

    zoomIn() {
        const { transform } = this.state;

        const newK = transform.k * 1.3;

        if (newK > 3) {
            return;
        }

        transform.k = newK;

        this.zoom(transform.k, undefined, undefined);
    }

    zoomOut() {
        const { transform } = this.state;
        const newK = transform.k * .7;

        if (newK < .3) {
            return;
        }

        transform.k = newK;

        this.zoom(transform.k, undefined, undefined);
    }

    render() {
        const { version } = this.props;
        const { frameTime } = this.state;
        const clientVersion = process.env.CLIENT_VERSION;

        return (
            <div className="graphComponent">
                <div className="graphContainer" ref={pixiContainer => this.pixiContainer = pixiContainer} />
                <p className="stats">
                    {(1000/frameTime).toFixed(1)} FPS<br />
                    SERVER VERSION: {version}<br />
                    CLIENT VERSION: {clientVersion}
                </p>
            </div>
        );
    }
}

const select = (state, ownProps) => {
    return {
        ...ownProps,
        nodes: state.entries.nodes,
        links: state.entries.links,
        highlightNodes: state.entries.nodes.filter(node => node.highlighted),
        searches: state.entries.searches,
        fields: state.entries.fields,
        items: state.entries.items,
        tooltipNodes: state.entries.nodes.filter(node => node.displayTooltip),
        version: state.entries.version,
        selectingMode: state.entries.selectingMode
    };
};

export default connect(select)(GraphPixi);
