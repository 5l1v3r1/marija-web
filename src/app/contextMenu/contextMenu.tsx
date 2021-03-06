import * as React from 'react';
import { FormEvent } from 'react';
import { connect, Dispatch } from 'react-redux';

import { Datasource } from '../datasources/interfaces/datasource';
import {
	deleteNodes, dontGroupNode,
	nodesSelect,
	nodeUpdate,
	setImportantNode, setNote
} from '../graph/graphActions';
import abbreviateNodeName from '../graph/helpers/abbreviateNodeName';
import getDirectlyRelatedNodes from '../graph/helpers/getDirectlyRelatedNodes';
import { Link } from '../graph/interfaces/link';
import { Node } from '../graph/interfaces/node';
import { AppState } from '../main/interfaces/appState';
import { Search } from '../search/interfaces/search';
import { searchAround } from '../search/searchActions';
import Icon from '../ui/components/icon';
import * as styles from './contextMenu.scss';
import { hideContextMenu } from './contextMenuActions';
import { openLightbox } from '../ui/uiActions';

interface Props {
    nodeId: number;
    nodes: Node[];
    links: Link[];
    x: number;
    y: number;
    dispatch: Dispatch<any>;
    searches: Search[];
    datasources: Datasource[];
}

interface State {
    renameOpened: boolean;
    renameTo: string;
    forceNoteOpen: boolean;
}

class ContextMenu extends React.Component<Props, State> {
    contextMenu: HTMLDivElement;
    renameInput: HTMLInputElement;

    state: State = {
        renameOpened: false,
        renameTo: '',
        forceNoteOpen: false
    };

    getNode(nodeId: number): Node {
        const { nodes } = this.props;

        return nodes.find(search => search.id === nodeId);
    }

    componentWillReceiveProps(nextProps: Props) {
        const { nodeId } = this.props;

        if (!nextProps.nodeId) {
            return;
        }

        const isDifferentNode: boolean = nextProps.nodeId !== nodeId;

        if (isDifferentNode) {
            const node = this.getNode(nextProps.nodeId);

            this.setState({
                renameOpened: false,
                renameTo: node.name,
                forceNoteOpen: false
            });
        }
    }

    selectRelated() {
        const { dispatch, nodes, links, nodeId } = this.props;

        const node = this.getNode(nodeId);
        const relatedNodes = getDirectlyRelatedNodes([node], nodes, links);
        dispatch(nodesSelect(relatedNodes));

        this.close();
    }

    delete() {
        const { dispatch, nodeId } = this.props;

        const node = this.getNode(nodeId);
        dispatch(deleteNodes([node]));

        this.close();
    }

    ungroup() {
		const { dispatch, nodeId } = this.props;

		const node = this.getNode(nodeId);

		dispatch(dontGroupNode(node));
		this.close();
    }

    searchAround() {
        const { dispatch, nodeId } = this.props;

        const node = this.getNode(nodeId);

		dispatch(searchAround(node));
        this.close();
    }

    close() {
        const { dispatch } = this.props;
        dispatch(hideContextMenu());
    }

    openRename() {
        this.setState({
            renameOpened: true
        });
    }

    handleRenameChange(event: FormEvent<HTMLInputElement>) {
        this.setState({
            renameTo: event.currentTarget.value
        });
    }

    handleRenameEvents(event: KeyboardEvent) {
        const { dispatch, nodeId, searches } = this.props;
        const { renameTo } = this.state;

        if (event.key === 'Enter') {
            const node = this.getNode(nodeId);
            const search = searches.find(loop => loop.searchId === node.searchIds[0]);

            dispatch(nodeUpdate(nodeId, {
                name: renameTo,
                abbreviated: abbreviateNodeName(renameTo, search.q, 20)
            }));

            this.setState({
                renameOpened: false
            });
        } else if (event.key === 'Escape') {
            const node = this.getNode(nodeId);

            this.setState({
                renameOpened: false,
                renameTo: node.name
            });
        }
    }

    handleRenameBlur() {
        this.setState({
            renameOpened: false
        });
    }

    handleImportant() {
        const { dispatch, nodeId } = this.props;

        dispatch(setImportantNode(nodeId, true));
		this.close();
    }

    handleNotImportant() {
        const { dispatch, nodeId } = this.props;

		dispatch(setImportantNode(nodeId, false));
		this.close();
    }

    componentDidUpdate() {
        const { nodeId, x, y } = this.props;

        if (!nodeId) {
            return;
        }

        const rect = this.contextMenu.getBoundingClientRect();
        const containerRect = this.contextMenu.parentElement.getBoundingClientRect();

        let newY: number = y;

        // Make sure the context menu fits on the page
        if (rect.height + y > containerRect.height) {
            newY = containerRect.height - rect.height;
        }

        let newX: number = x;

        if (rect.width + x > containerRect.width) {
            newX = containerRect.width - rect.width;
        }

        this.contextMenu.style.top = newY + 'px';
        this.contextMenu.style.left = newX + 'px';
    }

    handleAddNote() {
        this.setState({
            forceNoteOpen: true
        });
    }

    handleNoteChange(event: FormEvent<HTMLTextAreaElement>) {
        const { nodeId, dispatch } = this.props;

        dispatch(setNote(nodeId, event.currentTarget.value));
    }

    handleOpenImage() {
    	const { nodeId, dispatch } = this.props;

    	const image = this.getNode(nodeId).image;
    	dispatch(openLightbox(image));
    	this.close();
	}

    render() {
        const { nodeId } = this.props;
        const { renameOpened, renameTo, forceNoteOpen } = this.state;

        if (!nodeId) {
            return null;
        }

        let rename;

        if (renameOpened) {
            rename = (
                <div onClick={this.openRename.bind(this)} className={styles.inputWrapper}>
                    <Icon name={'ion-ios-compose ' + styles.icon} />
                    <input
                        autoFocus={true}
                        onChange={this.handleRenameChange.bind(this)}
                        onKeyDown={this.handleRenameEvents.bind(this)}
                        onBlur={this.handleRenameBlur.bind(this)}
                        ref={element => this.renameInput = element}
                        value={renameTo}
                    />
                </div>
            );
        } else {
            rename = (
                <button onClick={this.openRename.bind(this)} className={styles.button}>
                    <Icon name={'ion-ios-compose ' + styles.icon} />
                    <span className={styles.buttonText}>Rename</span>
                </button>
            );
        }

        const node = this.getNode(nodeId);

        let important;

        if (node.important) {
            important = (
                <button onClick={this.handleNotImportant.bind(this)} className={styles.button}>
                    <Icon name={'ion-alert-circled ' + styles.icon} />
                    <span className={styles.buttonText}>Undo important mark</span>
                </button>
            );
        } else {
            important = (
                <button onClick={this.handleImportant.bind(this)} className={styles.button}>
                    <Icon name={'ion-alert-circled ' + styles.icon} />
                    <span className={styles.buttonText}>Mark important</span>
                </button>
            );
        }

        let noteButton = null;
        let note = null;

        if (node.description || forceNoteOpen) {
            note = (
                <div className={styles.note}>
                    <textarea
                        autoFocus
                        onChange={event => this.handleNoteChange(event)}
                        defaultValue={node.description} />
                </div>
            );
        } else {
            noteButton = (
                <button onClick={this.handleAddNote.bind(this)} className={styles.button}>
                    <Icon name={'ion-ios-paper ' + styles.icon} />
                    <span className={styles.buttonText}>Add note</span>
                </button>
            );
        }

        let image = null;
        if (node.image) {
        	image = (
        		<li>
					<button onClick={this.handleOpenImage.bind(this)} className={styles.button}>
						<Icon name={'ion-image ' + styles.icon} />
						<span className={styles.buttonText}>Open image</span>
					</button>
				</li>
			)
		}

		let deleteElement = null;
        if (node.type === 'item') {
            // Connector nodes can not be deleted
            deleteElement = (
				<li>
					<button onClick={this.delete.bind(this)} className={styles.button}>
						<Icon name={'ion-ios-trash ' + styles.icon} />
						<span className={styles.buttonText}>Delete</span>
					</button>
				</li>
            );
        }

        let ungroup = null;
        if (node.count > 1) {
            ungroup = (
				<li>
					<button onClick={this.ungroup.bind(this)} className={styles.button}>
						<Icon name={'ion-android-share-alt ' + styles.icon} />
						<span className={styles.buttonText}>Ungroup {node.count} nodes</span>
					</button>
				</li>
            )
        }

        return (
            <div className={styles.contextMenu} ref={ref => this.contextMenu = ref}>
                <div className={styles.main}>
                    <h1 className={styles.title}>{node.name}</h1>
                    <ul>
                        {ungroup}
						{image}
						<li>
							<button onClick={this.searchAround.bind(this)} className={styles.button}>
								<Icon name={'ion-ios-search ' + styles.icon} />
								<span className={styles.buttonText}>Search around</span>
							</button>
						</li>
                        <li>
                            <button onClick={this.selectRelated.bind(this)} className={styles.button}>
                                <Icon name={'ion-qr-scanner ' + styles.icon} />
                                <span className={styles.buttonText}>Select related</span>
                            </button>
                        </li>
                        <li>
                            {rename}
                        </li>
                        <li>
                            {important}
                        </li>
                        <li>
                            {noteButton}
                        </li>
                        {deleteElement}
                    </ul>
                </div>
                {note}
            </div>
        );
    }
}


const select = (state: AppState, ownProps) => {
    return {
        ...ownProps,
        nodeId: state.contextMenu.nodeId,
        nodes: state.graph.nodes,
        links: state.graph.links,
        searches: state.graph.searches,
        datasources: state.datasources.datasources,
        x: state.contextMenu.x,
        y: state.contextMenu.y,
    };
};

export default connect(select)(ContextMenu);
