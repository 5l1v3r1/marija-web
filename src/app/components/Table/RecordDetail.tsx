import * as React from 'react';
import { map, mapValues, reduce, concat, isObject, forEach } from 'lodash';
import { fieldLocator } from '../../helpers/index';
import { Icon } from '../../components/index';
import Tooltip from 'rc-tooltip';

export default class Record extends React.Component<any, any> {
    constructor(props) {
        super(props);

        this.state = {
            editNode: null,
            expanded: false
        };
    }

    handleTableAddColumn(field) {
        const { onTableAddColumn } = this.props;
        onTableAddColumn(field);
    }

    handleTableRemoveColumn(field) {
        const { onTableRemoveColumn } = this.props;
        onTableRemoveColumn(field);
    }

    handleAddField(path: string) {
        const { onAddField } = this.props;
        onAddField(path);
    }

    handleMouseOver(id) {
        /*
        const { onMouseOver } = this.props;
        onMouseOver({nodes: [id]});
        */
    }

    extractAllFields(fields, keySeed: any = false) {
        return reduce(mapValues(fields, (value, key) => {
            const keyParts = [key];
            if (keySeed) {
                keyParts.unshift(keySeed);
            }

            const useKey = keyParts.join('.');
            if (value === null ) {
               return []; 
            } else if (typeof value.map == 'function') {
                return [useKey];
            } else if (typeof value == 'object') {
                return [].concat(this.extractAllFields(value, useKey));
            } else {
                return [useKey];
            }
        }), (result, value) => {
            return concat(result, value);
        });
    }

    renderFieldValue(value: any) {
        if (typeof value === 'string' || typeof value === 'number') {
            return value;
        } else if (typeof value === 'boolean') {
            return value ? 'yes' : 'no';
        } else if (Array.isArray(value)) {
            if (value.length === 1) {
                return this.renderFieldValue(value[0]);
            } else {
                return (
                    <ul>
                        {value.map((element, i) =>
                            <li key={i}>{this.renderFieldValue(element)}</li>
                        )}
                    </ul>
                );
            }
        } else if (isObject(value)) {
            const li = [];

            for (let key in value) {
                if (!value.hasOwnProperty(key)) {
                    continue;
                }

                li.push(
                    <li key={key}><strong>{key}:</strong> {this.renderFieldValue(value[key])}</li>
                )
            }

            return (
                <ul>
                    {li}
                </ul>
            );
        } else {
            return JSON.stringify(value);
        }
    }

    renderDetails(columns) {
        const { record, activeFields } = this.props;
        const allFields = this.extractAllFields(record.fields, false);

        const expandedFields = map(allFields, (value: any, key) => {
            const highlight = record.highlight || {};
            let field_value = highlight[value] || fieldLocator(record.fields, value) ;

            const activeAsColumn: boolean = columns.indexOf(value) !== -1;
            const activeAsField: boolean = activeFields.indexOf(value) !== -1;

            return (
                <tr key={ 'field_' + value }>
                    <td>{value}
                        <div className="fieldButtons">
                            <Tooltip
                                overlay={activeAsColumn ? 'Is used as column' : 'Add as column'}
                                placement="bottom"
                                mouseLeaveDelay={0}
                                arrowContent={<div className="rc-tooltip-arrow-inner" />}>
                                <Icon
                                    onClick={() => this.handleTableAddColumn(value)}
                                    name={'ion-ios-plus' + (activeAsColumn ? ' disabled' : '')}
                                />
                            </Tooltip>

                            <Tooltip
                                overlay={activeAsField ? 'Is used in graph' : 'Add to graph'}
                                placement="bottom"
                                mouseLeaveDelay={0}
                                arrowContent={<div className="rc-tooltip-arrow-inner" />}>
                                <Icon
                                    onClick={() => this.handleAddField(value)}
                                    name={'ion-android-share-alt' + (activeAsField ? ' disabled' : '')}
                                />
                            </Tooltip>
                        </div>
                    </td>
                    <td colSpan={3} className="fieldValue">{this.renderFieldValue(field_value)}</td>
                </tr>
            );
        });

        return (
            <td colSpan={columns.length + 1}>
                <div className="details">
                    <table>
                        <tbody>{ expandedFields }</tbody>
                    </table>
                </div>
            </td>
        );
    }


    render() {
        const { record, columns, node, expanded, className } = this.props;
        if (!expanded) {
            return null;
        }

        return (
            <tr className={className + ' recordDetail'} key={`record_detail_${record.id}`} >
                { this.renderDetails(columns) }
            </tr>
        );
    }
}
