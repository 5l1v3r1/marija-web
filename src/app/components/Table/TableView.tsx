import * as React from 'react';
import {connect, Dispatch} from 'react-redux';
import {saveAs} from 'file-saver';
import { forEach, uniqWith, reduce, find, findIndex, pull, concat, map } from 'lodash';
import { Record, RecordDetail, Icon } from '../index';
import { tableColumnAdd, tableColumnRemove } from '../../modules/data/index';
import {requestItems} from "../../modules/items/actions";
import {Item} from "../../interfaces/item";
import {Node} from "../../interfaces/node";
import {Normalization} from "../../interfaces/normalization";
import {Search} from "../../interfaces/search";
import {Field} from "../../interfaces/field";
import {dispatch} from "d3-dispatch";
import { fieldAdd } from '../../modules/data/index';
import {searchFieldsUpdate} from "../../modules/search/actions";
import { EventEmitter } from 'fbemitter';
import {getSelectedNodes} from "../../reducers/entriesSelectors";

interface Props {
    dispatch: Dispatch<any>;
    selectedNodes: Node[];
    items: Item[];
    fields: any;
    columns: any;
    normalizations: Normalization[];
    searches: Search[];
    availableFields: Field[];
    exportEvents: EventEmitter;
}

interface State {
    items: Item[];
    expandedItems: any[];
}

class TableView extends React.Component<Props, State> {
    state: State = {
        items: [],
        expandedItems: [],
    };

    toggleExpand(id) {
        if (findIndex(this.state.expandedItems, (o) => o === id) >= 0) {
            // remove 
            this.setState({expandedItems: pull(this.state.expandedItems, id)});
        } else {
            // add
            this.setState({expandedItems: concat(this.state.expandedItems, id)});
        }
    }

    handleTableAddColumn(field) {
        const { dispatch } = this.props;
        dispatch(tableColumnAdd(field));
    }

    handleTableRemoveColumn(field) {
        const { dispatch } = this.props;

        dispatch(tableColumnRemove(field));
    }

    handleAddField(path: string) {
        const { dispatch, availableFields } = this.props;
        const field = availableFields.find(search => search.path === path);

        dispatch(fieldAdd(field));
        dispatch(searchFieldsUpdate());
    }

    getSelectedItems(selectedNodes: Node[], items: Item[]) {
        // todo(nl5887): this can be optimized
        let selectedItems = reduce(selectedNodes, (result, node) => {
            for (var itemid of node.items) {
                const i = find(items, (i) => itemid === i.id);
                if (!i) {
                    console.error("could not find ", itemid, " in items?", items);
                    continue;
                }

                // check if already exists
                if (find(result, (i) => itemid == i.id)) {
                    i.nodes.push(node);
                    continue;
                }

                i.nodes = [node];
                result.push(i);
            };

            return result;
        }, []);

        return uniqWith(selectedItems, (value, other) => {
            return (value.id == other.id);
        });
    }

    requestData(selectedNodes: Node[], items: Item[]) {
        const selectedItems = this.getSelectedItems(selectedNodes, items);
        const { dispatch } = this.props;

        const request = selectedItems.filter(item => !item.requestedExtraData);

        if (request.length > 0) {
            dispatch(requestItems(request));
        }
    }

    componentWillReceiveProps(nextProps: Props) {
        if (nextProps.selectedNodes !== this.props.selectedNodes) {
            const items = this.getSelectedItems(nextProps.selectedNodes, nextProps.items);
            this.setState({items: items});
        }

        if (nextProps.selectedNodes.length !== this.props.selectedNodes.length) {
            // Fetch more info about the items from the server
            this.requestData(nextProps.selectedNodes, nextProps.items);
        }
    }

    componentDidMount() {
        const { exportEvents, selectedNodes, items } = this.props;

        this.requestData(selectedNodes, items);

        exportEvents.addListener('export', this.exportCsv.bind(this));
    }

    componentWillUnmount() {
        const { exportEvents } = this.props;

        exportEvents.removeAllListeners();
    }

    renderBody() {
        const { columns, searches, fields } = this.props;
        const { items } = this.state;

        const activeFields = fields.map(field => field.path);

        return map(items, (record, i) => {
            const expanded = (findIndex(this.state.expandedItems, function(o) { return o == record.id; }) >= 0);
            const className = (i % 2 === 0 ? 'odd' : 'even') + (columns.length ? '' : ' noColumns');

            return [
                <Record
                    key={'record' + record.id}
                    columns={ columns }
                    record={ record }
                    searches={ searches }
                    toggleExpand = { this.toggleExpand.bind(this) }
                    expanded = { expanded }
                    className={className}
                />,
                <RecordDetail
                    key={'recordDetail' + record.id}
                    columns={ columns }
                    record={ record }
                    onTableAddColumn={(field) => this.handleTableAddColumn(field) }
                    onTableRemoveColumn={(field) => this.handleTableRemoveColumn(field) }
                    onAddField={field => this.handleAddField(field)}
                    expanded = { expanded }
                    className={className}
                    activeFields={activeFields}
                />
            ];
        });
    }

    renderHeader() {
        const { columns } = this.props;

        return map(columns, (value) => {
            return (
                <th key={ 'header_' + value }>
                    <h1>
                        <span>{ value }</span>
                        <Icon onClick={(e) => this.handleTableRemoveColumn(value)} name="ion-ios-close-empty"/>
                    </h1>
                </th>
            );
        });
    }

    exportCsv() {
        const { items } = this.state;
        const { columns } = this.props;
        const table = [];
        const delimiter = '|';

        table.push(columns.join(delimiter));

        items.forEach(item => {
            const row = [];
            columns.forEach(column => row.push(item.fields[column]));
            table.push(row.join(delimiter));
        });

        const csv = table.join("\n");

        const blob = new Blob(
            [csv],
            {type: "text/csv;charset=utf-8"}
        );

        const now = new Date();
        const dateString = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        const filename = 'marija-export-table-' + dateString + '.csv';

        saveAs(blob, filename);
    }

    render() {
        const { items } = this.state;

        if (!items.length) {
            return <p className="noNodes">Select some nodes first</p>;
        }

        return (
            <div className="form-group">
                <table className="tableView">
                    <tbody>
                    <tr>
                        <th>
                        </th>
                        { this.renderHeader() }
                    </tr>
                    {this.renderBody()}
                    </tbody>
                </table>
            </div>
        );
    }
}


function select(state) {
    return {
        selectedNodes: getSelectedNodes(state),
        normalizations: state.entries.normalizations,
        items: state.entries.items,
        searches: state.entries.searches,
        fields: state.entries.fields,
        columns: state.entries.columns,
        availableFields: state.fields.availableFields
    };
}


export default connect(select)(TableView);
