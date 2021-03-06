import * as React from 'react';
import {connect, Dispatch} from 'react-redux';
import * as d3 from 'd3';
import { concat, debounce, remove, includes, assign, isEqual, isEmpty, forEach } from 'lodash';
import {
    nodesSelect, highlightNodes, deselectNodes, showTooltip
} from './graphActions';
import getArcParams from './helpers/getArcParams';
import getDirectlyRelatedNodes from './helpers/getDirectlyRelatedNodes';
import * as PIXI from 'pixi.js';
import {Search} from "../search/interfaces/search";
import {Node} from "./interfaces/node";
import {Link} from "./interfaces/link";
import {
    hideContextMenu,
    showContextMenu
} from "../contextMenu/contextMenuActions";
import {
	getSelectedNodes, selectNodesWithFilterHighlight
} from "./graphSelectors";
import {setFps} from "../stats/statsActions";
import {getArrowPosition} from "./helpers/getArrowPosition";
import {AppState} from "../main/interfaces/appState";
import * as Leaflet from 'leaflet';
import { isContextMenuActive } from '../contextMenu/contextMenuSelectors';
const myWorker = require('./helpers/d3Worker.worker');
import * as markerSvgImage from './marker.svg';
import {
	markPerformance,
	measurePerformance
} from '../main/helpers/performance';
import { Connector } from './interfaces/connector';
import { getNodeCanvas } from './helpers/getNodeCanvas';
import { getNodeImageCanvas } from './helpers/getNodeImageCanvas';
import { searchAround } from '../search/searchActions';
import Loader from '../ui/components/loader';
import MultiStyleText from 'pixi-multistyle-text';

interface TextureMap {
    [hash: string]: PIXI.RenderTexture;
}

interface Props {
    searches: Search[];
    nodes: Node[];
    links: Link[];
    selectedNodes: Node[];
    zoomEvents: any;
    centerEvents: any;
	resetPositionEvents: any;
    dispatch: Dispatch<any>;
    version: string;
    showLabels: boolean;
    isMapActive: boolean;
    isContextMenuActive: boolean;
    importantNodeIds: number[];
    connectors: Connector[];
	graphWorkerLoading: boolean;
}

interface State {
}

interface RenderedSince {
    lastTick: boolean;
    lastZoom: boolean;
    lastTooltip: boolean;
    lastSelection: boolean;
    lastQueries: boolean;
    lastHighlights: boolean;
    lastFields: boolean;
    lastNodeLableToggle: boolean;
}

class Graph extends React.PureComponent<Props, State> {
    pixiContainer: HTMLElement;
    state: State = {};
    renderedSince: RenderedSince = {
        lastTick: true,
        lastZoom: true,
        lastTooltip: true,
        lastSelection: true,
        lastQueries: true,
        lastHighlights: true,
        lastFields: true,
        lastNodeLableToggle: true
    };
    nodeTextures: TextureMap = {};
    nodeMarkerTextures: TextureMap = {};
    renderedNodesContainer: PIXI.Container = new PIXI.Container();
    renderedNodesContainers: Map<string, PIXI.particles.ParticleContainer> = new Map<string, PIXI.particles.ParticleContainer>();
    renderedLinks: PIXI.Graphics = new PIXI.Graphics();
    renderedLinkLabels: PIXI.Container = new PIXI.Container();
    renderedArrows: PIXI.Container = new PIXI.Container();
    arrowTexture: PIXI.RenderTexture;
    selection: any;
    renderedSelection: PIXI.Graphics = new PIXI.Graphics();
    renderer: PIXI.WebGLRenderer;
    renderedTooltip: PIXI.Container = new PIXI.Graphics();
    nodeLabelTextures: TextureMap = {};
    renderedNodeLabels: PIXI.Container = new PIXI.Container();
    iconTextures: TextureMap = {};
    renderedIcons: PIXI.Container = new PIXI.Container();
    stage: PIXI.Container = new PIXI.Container();
    worker: Worker;
    transform: any = d3.zoomIdentity;
    shift: boolean;
    lastLoopTimestamp: number;
    frameTime: number = 0;
    lastDispatchedFpsTimestamp: number = 0;
    linkLabelTextures: TextureMap = {};
    tooltipTextures: TextureMap = {};
    map: Leaflet.Map;
    mapMarkers: Leaflet.LayerGroup;
	initialMapZoom: number;
	initialMapBounds: Leaflet.LatLngBounds;
	mapOffset: Leaflet.Point = Leaflet.point(0, 0);
	graphComponent;
	isMouseDown: boolean = false;
	isZooming: boolean = false;
	mainDragSubject: Node;
    readonly minZoomGraph: number = .3;
    readonly maxZoomGraph: number = 3;
    readonly minZoomMap: number = 1;
    readonly maxZoomMap: number = 18;
    nodeMap = new Map<number, Node>();
    linkMap = new Map<number, Link>();
    lockRendering: boolean = false;
    isHighlighting: boolean = false;

    postWorkerMessage(message) {
    	this.worker.postMessage(JSON.stringify(message));
    }

    onWorkerMessage(event) {
    	if (event.data instanceof Float64Array) {
    		this.onWorkerTick(event.data);
    		return;
		}

        // switch (event.data.type) {
        //     case 'tick':
        //         break;
        //     case 'end':
        //         break;
        // }
    }

	/**
	 * This is aggressively optimized because it's executed on every frame.
	 * The normal way of sending data back and forth between workers and the main
	 * thread can be very slow. What we're doing instead is converting the data
	 * into a Float64Array, so that the data can be transferred in binary format.
	 * In this function the data is being parsed again, and attached to the nodes.
	 *
	 * @param data
	 */
	onWorkerTick(data: Float64Array) {
		const numNodes: number = data[0];
    	const propertiesPerNode: number = 3;
    	const nodesStopAt: number = numNodes * propertiesPerNode;

    	for (let i = 1; i <= nodesStopAt; i += propertiesPerNode) {
			const id: number = data[i];
			const nodeInMap: Node = this.nodeMap.get(id);

			if (!nodeInMap) {
				// Node is outdated
				break;
			}

			nodeInMap.x = data[i + 1];
			nodeInMap.y = data[i + 2];
		}

		const propertiesPerLink: number = 5;

		for (let i = nodesStopAt + 1; i < data.length; i += propertiesPerLink) {
			const hash: number = data[i];
			const linkInMap: Link = this.linkMap.get(hash);

			if (!linkInMap) {
				// Link is outdated
				break;
			}

			linkInMap.sourceX = data[i + 1];
			linkInMap.sourceY = data[i + 2];
			linkInMap.targetX = data[i + 3];
			linkInMap.targetY = data[i + 4];
		}

		this.lockRendering = false;
        this.renderedSince.lastTick = false;
    }

    createArrowTexture() {
        const width = 15;
        const height = 15;
        const sharpness = 8;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.moveTo(0, 0);
        ctx.lineTo(width, sharpness);
        ctx.lineTo(sharpness, height);
        ctx.fill();

        this.arrowTexture = PIXI.Texture.fromCanvas(canvas) as PIXI.RenderTexture;
    }

    resetZoom() {
    	this.transform.k = 1;
    	this.transform.x = 0;
    	this.transform.y = 0;
    	this.mapOffset = Leaflet.point(0, 0);
    	this.renderedSince.lastZoom = false;
	}

    d3ZoomStart() {
		this.isZooming = true;
	}

	tmpNodeSizeMultiplier: number;
	textureZoomDebouncer;

    d3Zoomed() {
    	if (!this.isZooming) {
    		return;
		}

		this.transform = d3.event.transform;

		this.zoom();
    }

    d3ZoomEnd() {
    	this.isZooming = false;
	}

	zoom() {
		const { nodes } = this.props;

		const newK = this.transform.k;
		this.tmpNodeSizeMultiplier = newK;
		this.renderedSince.lastTick = false;

		clearTimeout(this.textureZoomDebouncer);

		this.textureZoomDebouncer = setTimeout(() => {
			this.preProcessTextures(nodes, newK, this.props.searches, this.props.connectors, this.props.isMapActive)
				.then(() => {
					this.tmpNodeSizeMultiplier = undefined;
					this.nodeSizeMultiplier = newK;
					this.renderedSince.lastZoom = false;
				});
		}, 200);
	}

    mapZoomed(event) {
    	this.mapOffset = this.map.latLngToContainerPoint(this.initialMapBounds.getNorthWest());
		this.transform.k = this.map.getZoomScale(this.map.getZoom(), this.initialMapZoom);
		this.renderedSince.lastZoom = false;
	}

	fitMapToMarkers(nodes: Node[]) {
    	if (!this.map || !nodes.length) {
    		return;
		}

    	const coordinates: Leaflet.LatLng[] = nodes.map(node => {
			return new Leaflet.LatLng(node.geoLocation.lat, node.geoLocation.lng);
		});

    	this.map.fitBounds(Leaflet.latLngBounds(coordinates).pad(.2));
	}

    getSearchColor(searchId: string, searches: Search[]) {
        const search = searches.find(search => search.searchId === searchId);

        if (typeof search !== 'undefined') {
            return search.color;
        }
    }

    getConnectorColor(connectorName: string, connectors: Connector[]) {
		const connector = connectors.find(connector => connector.name === connectorName);

		if (!connector) {
			return '#52657a';
		}

		return connector.color;
	}

    getNodeTextureKey(node: Node, searches: Search[], connectors: Connector[]) {
    	let color: string;

    	if (node.type === 'item') {
    		color = node.searchIds.map(searchId => this.getSearchColor(searchId, searches)).join(',');
		} else  {
    		color = this.getConnectorColor(node.connector, connectors);
		}

        return node.icon
            + node.r
			+ node.count
			+ node.type
            + color;
    }

    getNodeTexture(node: Node, sizeMultiplier: number): PIXI.RenderTexture {
    	const key = node.textureKey + '-' + sizeMultiplier + '-' + (node.selected ? '1' : '0');
        let texture = this.nodeTextures[key];

        if (typeof texture === 'undefined') {
            throw new Error('Texture not found for ' + key);
        }

		return texture;
    }

    async setNodeTexture(node: Node, sizeMultiplier: number, selected: boolean, searches: Search[], connectors: Connector[]): Promise<true> {
		const key = node.textureKey + '-' + sizeMultiplier + '-' + (selected ? '1' : '0');
		let texture = this.nodeTextures[key];

		if (typeof texture !== 'undefined') {
			// Already exists
			return true;
		}

		const canvas = getNodeCanvas(node, sizeMultiplier, selected, searches, connectors);
		texture = PIXI.Texture.fromCanvas(canvas) as PIXI.RenderTexture;

		// Save in cache
		this.nodeTextures[key] = texture;

		return true;
	}

    static b64DecodeUnicode(str) {
		// Going backwards: from bytestream, to percent-encoding, to original string.
		return decodeURIComponent(window.atob(str).split('').map(function(c) {
			return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
		}).join(''));
	}

	static b64EncodeUnicode(str) {
		// first we use encodeURIComponent to get percent-encoded UTF-8,
		// then we convert the percent encodings into raw bytes which
		// can be fed into btoa.
		return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
			function toSolidBytes(match, p1) {
				const argument: any = '0x' + p1;
				return String.fromCharCode(argument);
			}));
	}

	getNodeMarkerTexture(node: Node): PIXI.RenderTexture {
    	const key = node.textureKey + '-' + (node.selected ? '1' : '0');
        let texture = this.nodeMarkerTextures[key];

        if (typeof texture === 'undefined') {
            throw new Error('Could not find node marker texture ' + key);
        }

        return texture;
    }

    async setNodeMarkerTexture(node: Node, selected: boolean, searches: Search[]): Promise<true> {
		const key = node.textureKey + '-' + (selected ? '1' : '0');
		let texture = this.nodeMarkerTextures[key];

		if (typeof texture !== 'undefined') {
			// Already exists
			return true;
		}

		const parser = new DOMParser();
		const base64 = markerSvgImage.replace('data:image/svg+xml;base64,', '');
		const doc = parser.parseFromString(Graph.b64DecodeUnicode(base64), 'image/svg+xml');
		const marker = doc.getElementById('marker');
		const color = this.getSearchColor(node.searchIds[0], searches);

		marker.setAttribute('fill', color);
		let strokeWidth: number = 0;

		if (selected) {
			strokeWidth = 2;
			marker.setAttribute('stroke', '#fac04b');
			marker.setAttribute('stroke-width', strokeWidth.toString());
		}

		const minRadius = 15;
		const maxRadius = 50;
		const scale = 1.7 + 3 * ((node.r - minRadius) / (maxRadius - minRadius));
		const originalWidthAndHeight = 24;

		const container = doc.getElementById('container');
		container.setAttribute('width', (scale * (originalWidthAndHeight) + strokeWidth * 2) + 'px');
		container.setAttribute('height', (scale * (originalWidthAndHeight) + strokeWidth * 2) + 'px');

		marker.setAttribute('transform', 'scale(' + scale + ') translate(' + strokeWidth + ', ' + strokeWidth + ')');

		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(doc);

		texture = PIXI.Texture.fromImage('data:image/svg+xml;charset=utf8;base64,' + Graph.b64EncodeUnicode(svgString)) as PIXI.RenderTexture;

		// Save in cache
		this.nodeMarkerTextures[key] = texture;

		return true;
	}

	getNodeImageTexture(node: Node, sizeMultiplier: number): PIXI.RenderTexture {
		const key = node.image + '-' + sizeMultiplier + '-' + (node.selected ? '1' : '0');
		let texture = this.nodeTextures[key];

		if (typeof texture === 'undefined') {
			throw new Error('Texture not found for node image ' + key);
		}

		return texture;
	}

	async setNodeImageTexture(node: Node, sizeMultiplier: number, selected: boolean): Promise<true> {
		const key = node.image + '-' + sizeMultiplier + '-' + (selected ? '1' : '0');
		let texture = this.nodeTextures[key];

		if (typeof texture !== 'undefined') {
			// Already exists
			return true;
		}

		const canvas = await getNodeImageCanvas(node, sizeMultiplier, selected);
		texture = PIXI.Texture.fromCanvas(canvas) as PIXI.RenderTexture;

		// Save in cache
		this.nodeTextures[key] = texture;

		return true;
	}

    getIconTexture(icon: string, sizeMultiplier: number): PIXI.RenderTexture {
    	const key = icon + '-' + sizeMultiplier;
        let texture: PIXI.RenderTexture = this.iconTextures[key];

        if (texture) {
            // Get from cache
            return texture;
        }

        const style = new PIXI.TextStyle({
            fontSize: 18 * sizeMultiplier,
            fontFamily: 'Ionicons',
            fill: 0xfac04b,
            dropShadow: true,
            dropShadowDistance: 1,
            dropShadowBlur: 3,
            dropShadowAlpha: .7
        });

        const text = new PIXI.Text(icon, style);
        const metrics = PIXI.TextMetrics.measureText(icon, style);

        texture = PIXI.RenderTexture.create(metrics.width, metrics.height);
        this.renderer.render(text, texture);

        // Save in cache
        this.iconTextures[key] = texture;

        return texture;
    }

    getNodeSizeMultiplier(): number {
    	const { isMapActive } = this.props;

    	if (isMapActive) {
    		// When the map is displayed, nodes always have the same size
    		return 1;
		}

		// When the normal graph is displayed, nodes get smaller when you zoom out
		return this.transform.k;
	}

	nodeSizeMultiplier: number = 1;

    renderNodes() {
        this.renderedNodesContainer.removeChildren();
        this.renderedIcons.removeChildren();

        this.nodeMap.forEach(this.renderNode.bind(this));
    }

    renderNode(node: Node) {
    	const { isMapActive } = this.props;

		if (typeof node.x === 'undefined') {
			return;
		}

		this.renderIcons(node);

		let texture: PIXI.RenderTexture;
		let anchorY: number;

		if (node.image) {
			texture = this.getNodeImageTexture(node, this.nodeSizeMultiplier);
			anchorY = .5;
		} else if (isMapActive && node.isGeoLocation) {
			texture = this.getNodeMarkerTexture(node);
			anchorY = 1;
		} else {
			texture = this.getNodeTexture(node, this.nodeSizeMultiplier);
			anchorY = .5;
		}

		const renderedNode = new PIXI.Sprite(texture);

		renderedNode.anchor.x = 0.5;
		renderedNode.anchor.y = anchorY;
		renderedNode.x = this.getRenderX(node.x);
		renderedNode.y = this.getRenderY(node.y);

		if (typeof this.tmpNodeSizeMultiplier === 'number' && this.nodeSizeMultiplier !== this.tmpNodeSizeMultiplier) {
			const scale = this.tmpNodeSizeMultiplier / this.nodeSizeMultiplier;
			renderedNode.scale = new PIXI.Point(scale, scale);
		}

		if (!this.isHighlighting) {
			renderedNode.alpha = 1;
		} else {
			let alpha: number;

			switch (node.highlightLevel) {
				case 1:
					alpha = 1;
					break;
				case 2:
					alpha = .7;
					break;
				case 3:
					alpha = .4;
					break;
				default:
					alpha = .1;
			}

			renderedNode.alpha = alpha;
		}

		this.renderedNodesContainer.addChild(renderedNode);
	}

    renderIcons(node: Node) {
        const icons: PIXI.Sprite[] = [];
        const sizeMultiplier = this.getNodeSizeMultiplier();

        if (node.important) {
            const warning = '\uF100';
            const texture = this.getIconTexture(warning, sizeMultiplier);
            icons.push(new PIXI.Sprite(texture));
        }

        if (node.description) {
            const note = '\uF482';
            const texture = this.getIconTexture(note, sizeMultiplier);
            icons.push(new PIXI.Sprite(texture));
        }

        let y = this.getRenderY(node.y) - (node.r + 5) * sizeMultiplier;

        icons.forEach(icon => {
            icon.x = this.getRenderX(node.x) + node.r * sizeMultiplier - icon.width / 2;
            icon.y = y;

            y += icon.height;

            this.renderedIcons.addChild(icon);
        });
    }

    renderLinks() {
        const { isMapActive } = this.props;

        this.renderedLinks.clear();
        this.renderedLinkLabels.removeChildren();
        this.renderedArrows.removeChildren();


        if (isMapActive) {
			this.renderedLinks.lineStyle(2, 0x4A5B71);
		}

		this.linkMap.forEach(this.linkStyleManager.bind(this));
    }

	// The renderer is faster when it doesnt need to switch line styles so often
    linkStyleManager(link: Link, index: number) {
    	const { links, isMapActive } = this.props;

    	if (!isMapActive) {
			const prevLink = links[index - 1];

			if (!prevLink
				|| (prevLink && link.color !== prevLink.color)
				|| (prevLink && link.highlighted !== prevLink.highlighted)) {

				let alpha: number = .7;

				if (this.isHighlighting && !link.highlighted) {
					alpha = .1;
				}

				let thickness = 1;
				const color = parseInt(link.color.replace('#', ''), 16);
				this.renderedLinks.lineStyle(thickness, color, alpha);
			}
		}

		this.renderLink(link);
	}

    renderArrow(x: number, y: number, angle: number) {
        const sprite = new PIXI.Sprite(this.arrowTexture);
        const offset = 15 * this.nodeSizeMultiplier;

        sprite.x = x + Math.cos(angle) * offset;
        sprite.y = y + Math.sin(angle) * offset;
        sprite.rotation = angle - .79;

        this.renderedArrows.addChild(sprite);
    }

    renderArrow2(x: number, y: number, angle: number) {
        const sprite = new PIXI.Sprite(this.arrowTexture);
        sprite.x = x;
        sprite.y = y;
        sprite.rotation = angle - .79;

        this.renderedArrows.addChild(sprite);
    }

    getRenderX(x: number): number {
    	const { isMapActive } = this.props;

    	let renderX = x * this.transform.k + this.transform.x;

    	if (isMapActive) {
    		renderX += this.mapOffset.x;
		}

		return renderX;
	}

	getRenderY(y: number): number {
		const { isMapActive } = this.props;

    	let renderY = y * this.transform.k + this.transform.y;

		if (isMapActive) {
			renderY += this.mapOffset.y;
		}

		return renderY;
	}

    renderLink(link: Link) {
		if (typeof link.sourceX === 'undefined') {
			return;
		}

		const sourceX = this.getRenderX(link.sourceX);
		const sourceY = this.getRenderY(link.sourceY);
		const targetX = this.getRenderX(link.targetX);
		const targetY = this.getRenderY(link.targetY);

        if (link.total <= 1) {
            // When there's only 1 link between 2 nodes, we can draw a straight line
            this.renderStraightLine(
                sourceX,
                sourceY,
                targetX,
                targetY
            );

            if (link.label) {
                this.renderTextAlongStraightLine(
                    link.label,
                    sourceX,
                    sourceY,
                    targetX,
                    targetY
                );
            }

            if (link.directional) {
				const deltaX = sourceX - targetX;
				const deltaY = sourceY - targetY;
				const angle = Math.atan2(deltaY, deltaX);

				this.renderArrow(targetX, targetY, angle);
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
                    sourceX,
                    sourceY,
                    targetX,
                    targetY,
                    bend
                );

            const normalizedEndAngle = (endAngle + Math.PI * 2) % (Math.PI * 2);
            const counterClockwise = bend < 0;
            const arrowPosition = getArrowPosition(centerX, centerY, radius, normalizedEndAngle, counterClockwise, targetX, targetY);

            if (link.directional) {
				this.renderArrow2(arrowPosition.x, arrowPosition.y, arrowPosition.angle);
			}

            this.renderArc(centerX, centerY, radius, startAngle, endAngle, counterClockwise);

            if (link.label) {
                const averageAngle = (startAngle + endAngle) / 2;

                this.renderTextAlongArc(link.label, centerX, centerY, radius, averageAngle, 7);
            }
        }
    }

    renderStraightLine(x1: number, y1: number, x2: number, y2: number) {
        this.renderedLinks.moveTo(x1, y1);
        this.renderedLinks.lineTo(x2, y2);
    }

    renderArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number, antiClockwise: boolean) {
        const xStart = centerX + radius * Math.cos(startAngle);
        const yStart = centerY + radius * Math.sin(startAngle);

        this.renderedLinks.moveTo(xStart, yStart);
        this.renderedLinks.arc(centerX, centerY, radius, startAngle, endAngle, antiClockwise);
    }

    renderTextAlongStraightLine(string: string, x1: number, y1: number, x2: number, y2: number) {
        const texture = this.getLinkLabelTexture(string);
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

        this.renderedLinkLabels.addChild(text);
    }

    getLinkLabelTexture(label: string) {
        let texture = this.linkLabelTextures[label];

        if (typeof texture !== 'undefined') {
            // Get from cache
            return texture;
        }

        const style = new PIXI.TextStyle({
            fontSize: 14,
            fill: 0xffffff
        });

        const text = new PIXI.Text(label, style);
        const metrics = PIXI.TextMetrics.measureText(label, style);

        texture = PIXI.RenderTexture.create(metrics.width, metrics.height);
        this.renderer.render(text, texture);

        // Save in cache
        this.linkLabelTextures[label] = texture;

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
        radius += distanceFromArc;

        if (typeof string !== 'string') {
            // typecast to string
            string += '';
        }

        const texture = this.getLinkLabelTexture(string);
        const totalAngle = texture.width / radius;
        const coordinates = this.getRopeCoordinates(angle - totalAngle / 2, angle + totalAngle / 2, radius);
        const rope = new PIXI.mesh.Rope(texture, coordinates);

        rope.x = centerX;
        rope.y = centerY;

        this.renderedLinkLabels.addChild(rope);
    }

    getTooltipNodes(): Node[] {
        const tooltipNodes: Node[] = [];

        this.nodeMap.forEach(node => {
        	if (node.displayTooltip) {
        		tooltipNodes.push(node);
			}
		});

        return tooltipNodes;
    }

    async preProcessTextures(nodes: Node[], sizeMultiplier: number, searches: Search[], connectors: Connector[], isMapActive: boolean): Promise<any> {
		nodes.forEach(node => {
			node.textureKey = this.getNodeTextureKey(node, searches, connectors);
		});

		const promises: Promise<any>[] = [];

		nodes.forEach(node => {
			if (isMapActive) {
				if (node.image) {
					promises.push(this.setNodeImageTexture(node, 1, true));
					promises.push(this.setNodeImageTexture(node, 1, false));
				} else if (node.isGeoLocation) {
					promises.push(this.setNodeMarkerTexture(node, true, searches));
					promises.push(this.setNodeMarkerTexture(node, false, searches));
				} else {
					promises.push(this.setNodeTexture(node, 1, true, searches, connectors));
					promises.push(this.setNodeTexture(node, 1, false, searches, connectors));
				}
			} else {
				if (node.image) {
					promises.push(this.setNodeImageTexture(node, sizeMultiplier, true));
					promises.push(this.setNodeImageTexture(node, sizeMultiplier, false));
				} else {
					promises.push(this.setNodeTexture(node, sizeMultiplier, true, searches, connectors));
					promises.push(this.setNodeTexture(node, sizeMultiplier, false, searches, connectors));
				}
			}
		});

		return Promise.all(promises);
	}

	updateNodeMap(nodes: Node[]) {
		const merged: Node[] = [];

		// Merge node from store and node in this component, to have both the new properties
		// and keep the x, y position
		nodes.forEach(node => {
			merged.push({
				...this.nodeMap.get(node.id),
				...node
			});
		});

		this.nodeMap.clear();
		merged.forEach(node => this.nodeMap.set(node.id, node));
		this.tooltipTextures = {};
	}

	updateLinkMap(links: Link[]) {
		const merged: Link[] = [];

		// Merge link from store and link in this component, to have both the new properties
		// and keep the x, y position
		links.forEach(link => {
			merged.push({
				...this.linkMap.get(link.hash),
				...link
			});
		});

		this.linkMap.clear();
		merged.forEach(link => this.linkMap.set(link.hash, link));
	}

    componentWillReceiveProps(nextProps: Props) {
        const { searches, nodes, links, showLabels, isMapActive, connectors } = this.props;

        this.isHighlighting = typeof nextProps.nodes.find(node =>
			node.highlightLevel !== null) !== 'undefined';

        if (nextProps.isMapActive && !isMapActive) {
        	this.initMap();
		}

		if (!nextProps.isMapActive && isMapActive) {
        	this.destroyMap();
			this.postWorkerMessage({
				type: 'init'
			});
        	this.resetFixedNodePositions(nextProps.nodes);
		}

		if (nextProps.isMapActive !== isMapActive) {
			this.setWorkerAreaForces(nextProps.isMapActive);
		}

        if (nextProps.nodes.filter(node => node.displayTooltip) !== this.getTooltipNodes()) {
            this.renderedSince.lastTooltip = false;
        }

		if (nextProps.nodes !== nodes
			|| nextProps.links !== links
			|| nextProps.searches !== searches
			|| nextProps.connectors !== connectors
			|| nextProps.isMapActive !== isMapActive) {

        	const sizeMultiplier = this.tmpNodeSizeMultiplier || this.nodeSizeMultiplier;

			this.preProcessTextures(nextProps.nodes, sizeMultiplier, nextProps.searches, nextProps.connectors, nextProps.isMapActive)
				.then(() => {
					if (typeof this.tmpNodeSizeMultiplier !== 'undefined') {
						this.nodeSizeMultiplier = this.tmpNodeSizeMultiplier;
						this.tmpNodeSizeMultiplier = undefined;
					}

					this.updateNodeMap(nextProps.nodes);
					this.updateLinkMap(nextProps.links);

					if (nextProps.nodes.length !== nodes.length || nextProps.isMapActive !== isMapActive) {
						this.postNodesAndLinksToWorker(
							nextProps.nodes,
							nextProps.links,
							nextProps.isMapActive
						);
					} else {
						this.renderedSince.lastTick = false;
						this.renderedSince.lastHighlights = false;
					}
				});
		}

        if (nextProps.showLabels !== showLabels) {
            this.renderedSince.lastNodeLableToggle = false;
        }
    }

    postNodesAndLinksToWorker(nodes: Node[], links: Link[], isMapActive: boolean) {
    	const maxLabelLength = 20;

        const nodesToPost = nodes.map(node => {
            let label = node.abbreviated;

            if (label.length > maxLabelLength) {
                label = label.substring(0, maxLabelLength) + '...';
            }

            let fx = undefined;
            let fy = undefined;

			if (isMapActive && node.isGeoLocation) {
				const containerPoint = this.map.latLngToContainerPoint(
					new Leaflet.LatLng(node.geoLocation.lat, node.geoLocation.lng)
				);

				fx = (containerPoint.x - this.mapOffset.x) / this.transform.k;
				fy = (containerPoint.y - this.mapOffset.y) / this.transform.k;
			}

			return {
				id: node.id,
				count: node.count,
				fx: fx,
				fy: fy,
				r: node.r
			};
        });

        const linksToPost = links.map(link => {
            return {
            	hash: link.hash,
                source: link.source,
                target: link.target
            };
        });

        if (isMapActive) {
			const markers = nodes.filter(node => node.isGeoLocation);
			this.fitMapToMarkers(markers);
		}

		markPerformance('beforePostToD3Worker');
        measurePerformance('graphWorkerOutput', 'beforePostToD3Worker');

        this.lockRendering = true;

        this.postWorkerMessage({
            type: 'update',
            nodes: nodesToPost,
            links: linksToPost
        });

		markPerformance('afterPostToD3Worker');
		measurePerformance('beforePostToD3Worker', 'afterPostToD3Worker');
    }

    renderSelection() {
		const { isMapActive } = this.props;

        this.renderedSelection.clear();

        if (this.selection) {
            const x1 = this.applyX(this.selection.x1);
            const x2 = this.applyX(this.selection.x2);
            const y1 = this.applyY(this.selection.y1);
            const y2 = this.applyY(this.selection.y2);
            const width = x2 - x1;
            const height = y2 - y1;

            const alpha: number = isMapActive ? .4 : .1;

            this.renderedSelection.beginFill(0xFFFFFF, alpha);
            this.renderedSelection.drawRect(
                x1,
                y1,
                width,
                height
            );
            this.renderedSelection.endFill();
        }
    }

    getSearches(searchIds: string[]): Search[] {
        const { searches } = this.props;

        return searches.filter(search =>
            searchIds.indexOf(search.searchId) !== -1
        );
    }

    getTooltipTexture(node: Node) {
        const key = node.id + '';
        let texture = this.tooltipTextures[key];

        if (typeof texture !== 'undefined') {
            // Get from cache
            return texture;
        }

        const container = new PIXI.Container();
        const searches = this.getSearches(node.searchIds);

        const queries: string[] = searches.map(search => search.q);

		const originalFields = Object.keys(node.childData);
		const maxFields = 10;
		let fields: string[];

		if (originalFields.length > maxFields) {
			fields = originalFields.slice(0, maxFields);
		} else {
			fields = originalFields;
		}

		const fieldValues: string[] = [];

		fields.forEach(field => {
			const value = node.childData[field];

			if (!value) {
				return;
			}

			let string: string;

			if (Array.isArray(value)) {
				string = value.join(', ');
			} else {
				string = value;
			}

			if (typeof string === 'string') {
				if (string.length > 50) {
					string = string.substring(0, 50);
					string += '...';
				}

				string = string.replace(/\n|\r/g, ' ');
			}

			fieldValues.push('<bold>' + field + ': </bold>' + string);
		});

		let description = fieldValues.join("\n");

		const textStyle = {
			default: {
				fontFamily: 'Arial',
				fontSize: '12px',
				fill: '#eeeeee',
				wordWrap: true,
				wordWrapWidth: 250
			},
			bold: {
				fontWeight: 'bold'
			}
		};

        const text = new MultiStyleText(description, textStyle);

        text.x = 10;
        text.y = 5;

        let footerText = '';
        let footer;

		if (originalFields.length > maxFields) {
			footerText += "\n<bold>Plus " + (originalFields.length - maxFields) + " more fields</bold>";
		}

		if (node.type === 'item') {
			footerText += "\n<bold>Queries: </bold>" + queries.join(', ')
				+ "\n<bold>Datasource: </bold>" + node.datasourceId;
		}

		if (footerText) {
			footer = new MultiStyleText(footerText, textStyle);
		}

        const backgroundWidth = (footer ? Math.max(footer.width, text.width) : text.width) + 20;
        const backgroundHeight = text.height + 10 + (footer ? footer.height : 0);
        const background = new PIXI.Graphics();
        background.beginFill(0x35394d, 1);
        background.lineStyle(1, 0x323447, 1);
        background.drawRoundedRect(0, 0, backgroundWidth, backgroundHeight, 14);

        container.addChild(background);
        container.addChild(text);

        if (footer) {
			const line = new PIXI.Graphics();
			line.lineStyle(1, 0xFFFFFF, 1);
			const y = text.height + 11;
			line.moveTo(0, y);
			line.lineTo(backgroundWidth, y);
			container.addChild(line);

        	footer.x = 10;
			footer.y = text.height;
        	container.addChild(footer);
		}

        texture = PIXI.RenderTexture.create(backgroundWidth, backgroundHeight);
        this.renderer.render(container, texture);

        // Save in cache
        this.tooltipTextures[key] = texture;

        return texture;
    }

    renderTooltip() {
        const tooltipNodes = this.getTooltipNodes();

        this.renderedTooltip.removeChildren();

        if (tooltipNodes.length === 0) {
            return;
        }

        tooltipNodes.forEach(node => {
        	if (!node.x) {
        		return;
			}

            const texture = this.getTooltipTexture(node);
            const sprite = new PIXI.Sprite(texture);

            sprite.x = this.applyX(node.x);
            sprite.y = this.applyY(node.y);

            this.renderedTooltip.addChild(sprite);
        });
    }

    applyX(x: number): number {
		const { isMapActive } = this.props;

		let transformed: number = this.transform.applyX(x);

		if (isMapActive) {
			transformed += this.mapOffset.x;
		}

		return transformed;
	}

	applyY(y: number): number {
		const { isMapActive } = this.props;

		let transformed: number = this.transform.applyY(y);

		if (isMapActive) {
			transformed += this.mapOffset.y;
		}

		return transformed;
	}

	invertX(x: number): number {
		const { isMapActive } = this.props;

		if (isMapActive) {
			x -= this.mapOffset.x;
		}


		let transformed: number = this.transform.invertX(x );

		return transformed;
	}

	invertY(y: number): number {
		const { isMapActive } = this.props;

		if (isMapActive) {
			y -= this.mapOffset.y;
		}

		return this.transform.invertY(y);
	}

    getNodeLabelTexture(label: string, isMapActive: boolean): PIXI.Texture {
        const key = label + '-' + isMapActive;
        let texture = this.nodeLabelTextures[key];

        if (typeof texture !== 'undefined') {
            // Get from cache
            return texture;
        }

        let style: PIXI.TextStyle = new PIXI.TextStyle({
			fontFamily: 'Arial',
			fontSize: '12px'
		});

        if (isMapActive) {
			style.stroke = 0xFFFFFF;
			style.strokeThickness = 3;
			style.fill = 0x000000;
		} else {
			style.dropShadow = true;
			style.dropShadowDistance = 1;
			style.dropShadowBlur = 3;
			style.dropShadowAlpha = .7;
			style.fill = 0xFFFFFF;
		}

        const text = new PIXI.Text(label, style);

        texture = PIXI.RenderTexture.create(text.width, text.height);
        this.renderer.render(text, texture);

        // Save in cache
        this.nodeLabelTextures[key] = texture;

        return texture;
    }

    renderNodeLabels() {
        const { showLabels, isMapActive } = this.props;

        this.renderedNodeLabels.removeChildren();

        if (!showLabels) {
        	this.nodeLabelTextures = {};
            return;
        }

		let sizeMultiplier;

		if (typeof this.tmpNodeSizeMultiplier === 'number' && this.tmpNodeSizeMultiplier !== this.nodeSizeMultiplier) {
			sizeMultiplier = this.tmpNodeSizeMultiplier;
		} else {
			sizeMultiplier = this.nodeSizeMultiplier;
		}

        this.nodeMap.forEach(node => {
        	if (!node.x) {
        		return;
			}

			if (this.isHighlighting && node.highlightLevel !== 1) {
        		return;
			}

            const texture = this.getNodeLabelTexture(node.abbreviated, isMapActive);
            const sprite = new PIXI.Sprite(texture);

            sprite.anchor.x = .5;
            sprite.x = this.getRenderX(node.x);
            sprite.y = this.getRenderY(node.y) + node.r * sizeMultiplier;

            this.renderedNodeLabels.addChild(sprite);
        });
    }

    shouldRenderGraph: boolean = true;

    renderGraph() {
    	if (this.shouldRenderGraph) {
    		markPerformance('renderStart');
            this.renderer.render(this.stage);
            this.shouldRenderGraph = false;
			markPerformance('renderEnd');
			measurePerformance('renderStart', 'renderEnd');//
        }

		markPerformance('drawStart');

        const shouldRender = (key) => {
            return !this.lockRendering && !this.renderedSince[key];
        };

        if (shouldRender('lastTick')
            || shouldRender('lastZoom')
            || shouldRender('lastQueries')
            || shouldRender('lastFields')
            || shouldRender('lastHighlights')) {

        	markPerformance('drawNodesStart');

            this.renderNodes();
            this.renderLinks();
            this.renderTooltip();
            this.renderNodeLabels();

			markPerformance('drawNodesEnd');
			measurePerformance('drawNodesStart', 'drawNodesEnd');

			this.shouldRenderGraph = true;

            this.renderedSince.lastTick = true;
            this.renderedSince.lastZoom = true;
            this.renderedSince.lastQueries = true;
            this.renderedSince.lastFields = true;
            this.renderedSince.lastHighlights = true;
        }

        if (shouldRender('lastNodeLableToggle')) {
            this.renderNodeLabels();

			this.shouldRenderGraph = true;
            this.renderedSince.lastNodeLableToggle = true;
        }

        if (shouldRender('lastSelection')) {
            this.renderSelection();

			this.shouldRenderGraph = true;
            this.renderedSince.lastSelection = true;
        }

        if (shouldRender('lastTooltip')) {
            this.renderTooltip();

			this.shouldRenderGraph = true;
            this.renderedSince.lastTooltip = true;
        }

        this.measureFps();

        markPerformance('drawEnd');
        measurePerformance('drawStart', 'drawEnd');

        requestAnimationFrame(this.renderGraph.bind(this));
    }

    measureFps() {
        const { dispatch } = this.props;

        if (!this.lastLoopTimestamp) {
            this.lastLoopTimestamp = Date.now() - 16;
        }

        const filterStrength = 10;
        const thisLoopTimestamp = Date.now();
        const thisFrameTime = thisLoopTimestamp - this.lastLoopTimestamp;

        this.frameTime = this.frameTime + (thisFrameTime - this.frameTime) / filterStrength;
        this.lastLoopTimestamp = thisLoopTimestamp;

        const msSinceDispatched: number = Date.now() - this.lastDispatchedFpsTimestamp;
        const twoSeconds = 2000;

        if (msSinceDispatched > twoSeconds) {
            const fps: number = 1000 / this.frameTime;

            dispatch(setFps(fps));
            this.lastDispatchedFpsTimestamp = Date.now();
        }
    }

    initGraph() {
        const { width, height } = this.pixiContainer.getBoundingClientRect();

		PIXI.ticker.shared.autoStart = false;

        this.renderer = new PIXI.WebGLRenderer({
            antialias: true,
            transparent: true,
            resolution: 1,
            width: width,
            height: height
        });

        this.renderer.render(this.stage);

        this.pixiContainer.appendChild(this.renderer.view);

		// this.renderedLinks.nativeLines = true;

        this.stage.addChild(this.renderedLinks);
        this.stage.addChild(this.renderedLinkLabels);
        this.stage.addChild(this.renderedNodesContainer);
        this.stage.addChild(this.renderedSelection);
        this.stage.addChild(this.renderedNodeLabels);
        this.stage.addChild(this.renderedArrows);
        this.stage.addChild(this.renderedIcons);
        this.stage.addChild(this.renderedTooltip);

        this.graphComponent.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.graphComponent.addEventListener('mousemove', this.onMouseMove.bind(this), true);
        this.graphComponent.addEventListener('mouseup', this.onMouseUp.bind(this), true);
        this.graphComponent.addEventListener('click', this.clickEnded.bind(this), true);

        this.renderGraph();
        this.enableD3Zooming();
    }

    enableD3Zooming() {
    	this.resetZoom();

		const zooming = d3.zoom()
			.filter(() => {
				if (this.isZooming) {
					return true;
				}

				if (this.shift) {
					return false;
				}

				if (d3.event instanceof WheelEvent) {
					// We can always zoom, even if the cursor is on a node
					return true;
				}

				const { x, y } = this.getMouseCoordinates(d3.event);
				const transformedX = this.transform.invertX(x);
				const transformedY = this.transform.invertY(y);

				// We can only move around if the cursor is not on a node (because the user might be dragging that node)
				return typeof this.findNode(transformedX, transformedY) === 'undefined';
			})
		    .scaleExtent([this.minZoomGraph, this.maxZoomGraph])
			.on('start', this.d3ZoomStart.bind(this))
		    .on('zoom', this.d3Zoomed.bind(this))
			.on('end', this.d3ZoomEnd.bind(this));

		d3.select(this.graphComponent)
		    .call(zooming)
		    .on('dblclick.zoom', null);
    }

    disableD3Zooming() {
		this.resetZoom();
		d3.select(this.graphComponent).on('.zoom', null);
    }

    initWorker() {
		this.worker = new myWorker();
		this.worker.onmessage = (event) => this.onWorkerMessage(event);

		this.postWorkerMessage({
			type: 'init'
		});
	}

	setWorkerAreaForces(isMapActive: boolean) {
		const { width, height } = this.pixiContainer.getBoundingClientRect();

		this.postWorkerMessage({
			type: 'setAreaForces',
			clientWidth: width,
			clientHeight: height,
			active: !isMapActive
		});
	}

	resetFixedNodePositions(nodes: Node[]) {
    	nodes.forEach(node => {
    		node.fx = undefined;
    		node.fy = undefined;
		});
	}

    initMap() {
        this.disableD3Zooming();

        this.map = Leaflet.map('map', {
        	minZoom: this.minZoomMap,
			maxZoom: this.maxZoomMap,
			zoomSnap: 1,
			boxZoom: false,
			doubleClickZoom: false,
			zoomAnimation: true,
			fadeAnimation: true,
			zoomControl: false
		}).setView([51.505, -0.09], 10);

        this.initialMapZoom = this.map.getZoom();
        this.initialMapBounds = this.map.getBounds();
        this.mapMarkers = Leaflet.layerGroup();
        this.mapMarkers.addTo(this.map);

		const street = Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(this.map);

		const satellite = Leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
			minZoom: 1,
			maxZoom: 22,
			attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
		});

		const overlays = {
			'Satellite': satellite,
			'Map': street
		};

		Leaflet.control.layers(overlays, null, {
			collapsed: false
		}).addTo(this.map);

		this.map.on('zoom zoomend move moveend', this.mapZoomed.bind(this));
		this.map.on('zoomstart movestart', this.mapZoomStart.bind(this));
		this.map.on('zoomend moveend', this.mapZoomEnd.bind(this));
    }

    mapZoomStart() {
    	clearTimeout(this.zoomEndTimeout);
    	this.pixiContainer.hidden = true;
	}

	zoomEndTimeout;

	mapZoomEnd() {
		clearTimeout(this.zoomEndTimeout);

		this.zoomEndTimeout = setTimeout(
			() => this.pixiContainer.hidden = false,
			100
		);
	}

    destroyMap() {
    	this.map.remove();
    	this.enableD3Zooming();
	}

    componentDidMount() {
        const { zoomEvents, isMapActive, centerEvents, resetPositionEvents } = this.props;

        this.createArrowTexture();
        this.initWorker();
        this.setWorkerAreaForces(isMapActive);
        this.initGraph();

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        zoomEvents.addListener('zoomIn', this.zoomIn.bind(this));
        zoomEvents.addListener('zoomOut', this.zoomOut.bind(this));
        resetPositionEvents.addListener('resetPosition', this.onResetPosition.bind(this));
        centerEvents.addListener('center', this.centerView.bind(this));
        window.addEventListener('blur', this.onBlur.bind(this));
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        document.removeEventListener('keyup', this.handleKeyUp.bind(this));
        window.removeEventListener('resize', this.handleWindowResize.bind(this));
    }

    onResetPosition(nodes: Node[]) {
		const nodesToPost: Node[] = nodes.map(node => {
			return {
				...node,
				fx: null,
				fy: null
			}
		});

		this.postWorkerMessage({
			nodes: nodesToPost,
			type: 'restart'
		});
	}

    centerView() {
		const { nodes, isMapActive } = this.props;

		if (isMapActive) {
			this.fitMapToMarkers(nodes.filter(node => node.isGeoLocation));
			return;
		}

		let minX: number;
		let maxX: number;
		let minY: number;
		let maxY: number;

		this.nodeMap.forEach(node => {
			if (!node.x) {
				return;
			}

			if (!minX) {
				minX = node.x;
				maxX = node.x;
				minY = node.y;
				maxY = node.y;
			}

			minX = Math.min(node.x, minX);
			maxX = Math.max(node.x, maxX);
			minY = Math.min(node.y, minY);
			maxY = Math.max(node.y, maxY);
		});

		// Top margin because of graph buttons
		const topMargin = 70;
		const bottomMargin = 20 * this.nodeSizeMultiplier;
		const sideMargin = 20 * this.nodeSizeMultiplier;

		let { width, height } = this.pixiContainer.getBoundingClientRect();
		height -= (topMargin + bottomMargin);
		width -= sideMargin * 2;

		const naturalWidth = maxX - minX;
		const horizontalZoom = width / naturalWidth;
		const naturalHeight = maxY - minY;
		const verticalZoom = height / naturalHeight;
		let zoom = Math.min(horizontalZoom, verticalZoom);
		zoom = Math.min(this.maxZoomGraph, zoom);
		zoom = Math.max(this.minZoomGraph, zoom);

		const leftOverWidth = width - zoom * naturalWidth;
		const leftOverHeight = height - zoom * naturalHeight;

		this.transform.k = zoom;
		this.transform.x = -1 * zoom * minX + sideMargin + leftOverWidth / 2;
		this.transform.y = -1 * zoom * minY + topMargin + leftOverHeight / 2;

		this.zoom();
	}

    handleWindowResize = debounce(() => {
        const { width, height } = this.pixiContainer.getBoundingClientRect();

        this.renderer.resize(width, height);

        this.renderedSince.lastZoom = false;
    }, 500);


    findNode(x, y): Node {
    	const sizeMultiplier = this.getNodeSizeMultiplier();
		let found: Node;

		this.nodeMap.forEach(node => {
			if (found || !node.x) {
				return;
			}

			const dx = x - node.x;
			const dy = y - node.y;
			const d2 = dx * dx + dy * dy;

			if (d2 < Math.pow(node.r * sizeMultiplier / this.transform.k, 2)) {
				found = node;
			}
		});

		return found;
    }

    tooltipNode(node: Node) {
        const { dispatch } = this.props;
        const tooltipNodes = this.getTooltipNodes();

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

    getMouseCoordinates(event: MouseEvent) {
    	const rect = this.pixiContainer.getBoundingClientRect();

    	let x = event.clientX - rect.left;

    	if (x < 0 || x > rect.width) {
    		x = null;
		}

		let y = event.clientY - rect.top;

    	if (y < 0 || y > rect.height) {
    		y = 0;
		}

        return {
			x,
			y
		};
    }

    mouseDownCoordinates: { x: number; y: number };

    onMouseDown(event: MouseEvent) {
    	event.preventDefault();

    	const { isMapActive } = this.props;
    	this.isMouseDown = true;

        this.mouseDownCoordinates = this.getMouseCoordinates(event);
		const transformedX = this.invertX(this.mouseDownCoordinates.x);
		const transformedY = this.invertY(this.mouseDownCoordinates.y);
		const node = this.findNode(transformedX, transformedY);

        // When dragging a node, prevent also dragging the map at the same time
		if (isMapActive) {
			const draggingEnabled = this.map.dragging.enabled();

			if (draggingEnabled && node) {
				this.map.dragging.disable();
			} else if (!draggingEnabled && !node) {
				this.map.dragging.enable();
			}
		}

		if (node && (!isMapActive || !node.isGeoLocation)) {
			this.mainDragSubject = node;
			const { nodes, links, selectedNodes } = this.props;

			if (event.altKey) {
				this.dragSubjects = getDirectlyRelatedNodes([node], nodes, links);
			} else if (node.selected) {
				this.dragSubjects = selectedNodes;
			}
		}

		if (this.shift) {
			this.selection = { x1: transformedX, y1: transformedY, x2: transformedX, y2: transformedY };
		}
    }

    dragSubjects: Node[] = [];

    onMouseMove(event: MouseEvent) {
		event.preventDefault();

    	const { dispatch, nodes, links, isContextMenuActive } = this.props;

		if (isContextMenuActive) {
			this.mainDragSubject = null;
			this.isMouseDown = false;
			return;
		}

        const { x, y } = this.getMouseCoordinates(event);

        if (x === null || y === null) {
        	// Cursor is outside graph container, cancel dragging
			this.isMouseDown = false;
			this.mainDragSubject = null;

			return;
		}

        const transformedX = this.invertX(x);
        const transformedY = this.invertY(y);

        if (this.shift) {
            this.selection = {
                ...this.selection,
                x2: transformedX,
                y2: transformedY
            };

            this.renderedSince.lastSelection = false;
        } else if (this.isMouseDown && this.mainDragSubject) {
        	// Dragging
			this.mainDragSubject.fx = transformedX;
        	this.mainDragSubject.fy = transformedY;

        	const subjects: Node[] = [this.mainDragSubject];

			const deltaX = transformedX - this.mainDragSubject.x;
			const deltaY = transformedY - this.mainDragSubject.y;

			this.dragSubjects.forEach(node => {
				node = this.nodeMap.get(node.id);

				if (node.id === this.mainDragSubject.id) {
					return;
				}

				node.fx = node.x + deltaX;
				node.fy = node.y + deltaY;

				subjects.push(node);
			});

			this.postWorkerMessage({
				nodes: subjects,
				type: 'restart'
			});
		} else {
        	// Display tooltip
            const tooltipNodes = this.getTooltipNodes();
            const tooltip = this.findNode(transformedX, transformedY);

            if (tooltipNodes[0] === tooltip) {
                // Nothing changed
                return;
            }

            this.tooltipNode(tooltip);

            let related = [];

            if (tooltip) {
                related = getDirectlyRelatedNodes([tooltip], nodes, links);
            }

            dispatch(highlightNodes(related));
        }
    }

    onMouseUp(event) {
    	this.isMouseDown = false;
    	this.mainDragSubject = null;
    	this.dragSubjects = [];

		if (this.selection && this.shift) {
			this.selectionEnded();
		}
	}

    selectionEnded() {
        const { dispatch } = this.props;

        const willSelect: Node[] = [];

        this.nodeMap.forEach(node => {
            const withinX: boolean =
                (node.x > this.selection.x1 && node.x < this.selection.x2)
                || (node.x > this.selection.x2 && node.x < this.selection.x1);

            const withinY: boolean =
                (node.y > this.selection.y1 && node.y < this.selection.y2)
                || (node.y > this.selection.y2 && node.y < this.selection.y1);

            if (withinX && withinY) {
                willSelect.push(node);
            }
        });

        dispatch(nodesSelect(willSelect));

        this.selection = null;
        this.renderedSince.lastSelection = false;
    }

    clickEnded(event: MouseEvent) {
    	if (!this.mouseDownCoordinates) {
    		return;
		}

    	const { dispatch } = this.props;
        const { x, y } = this.getMouseCoordinates(event);

		const isClick = Math.abs(x - this.mouseDownCoordinates.x) < 5 && Math.abs(y - this.mouseDownCoordinates.y) < 5;

		if (!isClick) {
			return;
		}

        const transformedX = this.invertX(x);
        const transformedY = this.invertY(y);
        const node = this.findNode(transformedX, transformedY);

        if (node) {
            if (node.selected) {
                dispatch(deselectNodes([node]));
            } else {
                dispatch(nodesSelect([node]));
            }
        } else {
            // Deselect all when clicking on empty space
            const { selectedNodes } = this.props;

            dispatch(deselectNodes(selectedNodes));
        }

        dispatch(hideContextMenu());
    }

    handleKeyDown(event: KeyboardEvent) {
        const shiftKey = 16;

        if (event.keyCode === shiftKey) {
            this.shift = true;
        }
    }

    handleKeyUp(event: KeyboardEvent) {
        const shiftKey = 16;

        if (event.keyCode === shiftKey) {
            this.shiftDisengaged();
        }
    }

    shiftDisengaged() {
        this.shift = false;
        this.selection = null;
        this.renderedSince.lastSelection = false;
    }

    onBlur() {
    	this.shiftDisengaged();
    	this.isMouseDown = false;
    	this.mainDragSubject = null;
	}

    zoomIn() {
    	const { isMapActive } = this.props;

    	if (isMapActive) {
    		this.map.zoomIn();
    		return;
		}

        const newK = this.transform.k * 1.3;

        if (newK > this.maxZoomGraph) {
            return;
        }

        this.transform.k = newK;
        this.zoom();
    }

    zoomOut() {
		const { isMapActive } = this.props;

		if (isMapActive) {
			this.map.zoomOut();
			return;
		}

        const newK = this.transform.k * .7;

        if (newK < this.minZoomGraph) {
            return;
        }

        this.transform.k = newK;
        this.zoom();
    }

    onContextMenu(event) {
		const { dispatch } = this.props;

        event.preventDefault();

        const rect: ClientRect = this.pixiContainer.getBoundingClientRect();
        const { x, y } = this.getMouseCoordinates(event);
        const transformedX = this.invertX(x);
        const transformedY = this.invertY(y);
        const node = this.findNode(transformedX, transformedY);
        this.isMouseDown = false;
        this.mainDragSubject = null;

        if (node) {
            dispatch(showContextMenu(node.id, x, y));

            // Hide tooltip, because it looks weird to have both active at the
            // same time
            dispatch(showTooltip([]));
        }
    }

    onDoubleClick(event) {
		const { dispatch } = this.props;

		event.preventDefault();

		const rect: ClientRect = this.pixiContainer.getBoundingClientRect();
		const { x, y } = this.getMouseCoordinates(event);
		const transformedX = this.invertX(x);
		const transformedY = this.invertY(y);
		const node = this.findNode(transformedX, transformedY);

		if (node) {
			dispatch(searchAround(node));
		}
	}

    hideContextMenu() {
        const { dispatch } = this.props;
        dispatch(hideContextMenu());
    }

    render() {
    	const { isMapActive, graphWorkerLoading } = this.props;

        return (
			<div
				className="graphComponent"
				onContextMenu={this.onContextMenu.bind(this)}
				onDoubleClick={this.onDoubleClick.bind(this)}
				ref={ref => this.graphComponent = ref}>
				<div
					className={'graphContainer ' + (isMapActive ? 'mapIsActive' : 'mapIsNotActive')}
					ref={pixiContainer => this.pixiContainer = pixiContainer}
					onClick={this.hideContextMenu.bind(this)}
				/>
				{graphWorkerLoading && (
					<div className="graphWorkerLoading">
						<Loader classes={['graphWorkerLoader']} show={true}/>
					</div>
				)}
				<div id="map" className={isMapActive ? 'mapIsActive' : 'mapIsNotActive' } />
			</div>
        );
    }
}

const select = (state: AppState, ownProps) => {
    return {
        ...ownProps,
        nodes: selectNodesWithFilterHighlight(state),
        links: state.graph.links,
		selectedNodes: getSelectedNodes(state),
        searches: state.graph.searches,
        showLabels: state.graph.showLabels,
		isMapActive: state.graph.isMapActive,
		isContextMenuActive: isContextMenuActive(state),
		imporantNodeIds: state.graph.importantNodeIds,
		connectors: state.fields.connectors,
		graphWorkerLoading: state.graph.graphWorkerLoading
    };
};

export default connect(select)(Graph);
