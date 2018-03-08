import * as React from 'react';
import { connect, Dispatch } from 'react-redux';
import { map, isEqual } from 'lodash';
import { fieldAdd, fieldDelete, fieldUpdate } from '../../../modules/data/index';
import { Field as FieldComponent} from '../../../modules/fields/index';
import { Icon } from '../../index';
import Url from "../../../domain/Url";
import Loader from "../../Misc/Loader";
import {saveAs} from 'file-saver';
import {searchFieldsUpdate} from "../../../modules/search/actions";
import {fieldNodesHighlight, highlightNodes} from "../../../modules/graph/actions";
import {Datasource} from "../../../interfaces/datasource";
import {Field} from "../../../interfaces/field";
import IconSelector from '../iconSelector/iconSelector';
import * as styles from './fields.scss';
import {FormEvent} from "react";

interface State {
    currentFieldSearchValue: string;
    currentDateFieldSearchValue: string;
    searchTypes: any[],
    maxSearchResults: number;
    iconSelectorField: string | null;
    datasourceFilter: string | null;
}

interface Props {
    dispatch: Dispatch<any>;
    fields: Field[];
    availableFields: Field[];
    date_fields: Field[];
    datasources: Datasource[];
    fieldsFetching: boolean;
}

class Fields extends React.Component<Props, State> {
    defaultMaxSearchResults = 10;
    searchInput: HTMLElement;
    state: State = {
        currentFieldSearchValue: '',
        currentDateFieldSearchValue: '',
        searchTypes: [],
        maxSearchResults: this.defaultMaxSearchResults,
        iconSelectorField: null,
        datasourceFilter: null
    };

    handleAddField(field) {
        const { dispatch } = this.props;

        Url.addQueryParam('fields', field.path);

        dispatch(fieldAdd({
            path: field.path,
            type: field.type
        }));

        dispatch(searchFieldsUpdate());

        this.searchInput.focus();
    }

    handleFieldSearchChange(event) {
        this.setState({
            currentFieldSearchValue: event.target.value,
            maxSearchResults: this.defaultMaxSearchResults
        });
    }

    componentWillReceiveProps(nextProps: Props) {
        if (!isEqual(nextProps.datasources, this.props.datasources)) {
            this.setState({
                datasourceFilter: null
            });
        }
    }

    handleDeleteField(field) {
        const { dispatch } = this.props;

        Url.removeQueryParam('fields', field.path);

        dispatch(fieldDelete(field));
    }

    types = [
        {
            label: 'yes/no',
            types: ['boolean']
        },
        {
            label: 'date',
            types: ['date']
        },
        {
            label: 'text',
            types: ['text', 'keyword']
        },
        {
            label: 'number',
            types: ['long', 'double', 'int']
        },
        {
            label: 'location',
            types: ['geo_point']
        },
    ];

    getTypes(fields) {
        const types = [];

        fields.forEach(field => {
            if (types.indexOf(field.type) === -1) {
                types.push(field.type);
            }
        });

        const typeItems = [];
        types.forEach(type => {
            const alreadyUsed = typeItems.reduce((prev, item) => prev.concat(item.types), []);

            if (alreadyUsed.indexOf(type) !== -1) {
                return;
            }

            const typeItem = this.types.find(search => search.types.indexOf(type) !== -1);

            if (typeItem) {
                typeItems.push(typeItem);
            } else {
                typeItems.push({
                    label: type,
                    types: [type]
                });
            }
        });

        return typeItems;
    }

    handleTypeChange(e, type) {
        this.setState({
            searchTypes: type
        });
    }

    handleMaxSearchResultsChange(max) {
        this.setState({
            maxSearchResults: max
        });
    }

    highlightNodes(field: string) {
        const { dispatch } = this.props;

        dispatch(fieldNodesHighlight(field));
    }

    removeHighlightNodes() {
        const { dispatch } = this.props;

        dispatch(highlightNodes([]));
    }

    toggleFieldSelector(fieldPath: string) {
        const { iconSelectorField } = this.state;

        this.setState({
            iconSelectorField: fieldPath === iconSelectorField ? null : fieldPath
        });
    }

    renderTypeFilter() {
        const { availableFields } = this.props;
        const { searchTypes } = this.state;

        const types = [{
            label: 'all types',
            types: []
        }].concat(this.getTypes(availableFields));

        return (
            <div className={'row ' + styles.filter}>
                <div className="col-xs-12">
                    <div className={styles.filterContent}>
                        {types.map(type => {
                            const key = 'search_types_' + type.types.join(',');

                            return (
                                <div className="form-check form-check-inline" key={key}>
                                    <input
                                        type="radio"
                                        className="form-check-input"
                                        name="type"
                                        id={key}
                                        checked={isEqual(type.types, searchTypes)}
                                        onChange={(e) => this.handleTypeChange(e, type.types)}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor={key}>
                                        {type.label}
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    handleDatasourceChange(datasource: string) {
        this.setState({
            datasourceFilter: datasource
        });
    }

    renderDatasourceFilter() {
        const { datasources } = this.props;
        const { datasourceFilter } = this.state;

        const activeDatasources = datasources.filter(datasource => datasource.active);

        if (activeDatasources.length < 2) {
            return null;
        }

        const options = [{
            label: 'all datasources',
            id: null
        }].concat(activeDatasources.map(datasource => ({
            label: datasource.name,
            id: datasource.id
        })));

        return (
            <div className={'row ' + styles.filter}>
                <div className="col-xs-12">
                    <div className={styles.filterContent}>
                        {options.map(option=> {
                            const key = 'datasources_' + option.id;

                            return (
                                <div className="form-check form-check-inline" key={key}>
                                    <input
                                        type="radio"
                                        className="form-check-input"
                                        name="datasource"
                                        id={key}
                                        checked={option.id === datasourceFilter}
                                        onChange={() => this.handleDatasourceChange(option.id)}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor={key}>
                                        {option.label}
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    renderFields(fields, availableFields) {
        const { currentFieldSearchValue, searchTypes, maxSearchResults, iconSelectorField, datasourceFilter } = this.state;

        const options = map(fields, (field: any) => {
            let iconSelector = null;

            if (iconSelectorField === field.path) {
                iconSelector = <IconSelector onSelectIcon={(icon: string) => this.onSelectIcon(field, icon)}/>;
            }

            return (
                <li
                    className={styles.selectedField}
                    key={'field_' + field.path}
                    value={ field.path }
                    onMouseEnter={() => this.highlightNodes(field.path)}>
                    { field.path }
                    <i className={styles.fieldIcon} onClick={() => this.toggleFieldSelector(field.path)}>{ field.icon }</i>
                    <Icon onClick={() => this.handleDeleteField(field)} name="ion-ios-trash-outline"/>
                    {iconSelector}
                </li>
            );
        });

        let filteredFields = availableFields.concat([]);

        // Filter by type, if we are searching on a certain type
        if (searchTypes.length > 0) {
            filteredFields = filteredFields.filter(item =>
                searchTypes.indexOf(item.type) !== -1
            );
        }

        if (datasourceFilter !== null) {
            filteredFields = filteredFields.filter(field =>
                field.datasourceId === datasourceFilter
            );
        }

        // Only fields that have not already been added
        filteredFields = filteredFields.filter(field =>
            typeof fields.find(search => search.path === field.path) === 'undefined'
        );

        const search = (
            <form>
                <div className="row">
                    <div className="col-xs-12">
                        <input
                            className="form-control searchInput"
                            ref={searchInput => this.searchInput = searchInput}
                            value={this.state.currentFieldSearchValue}
                            onChange={this.handleFieldSearchChange.bind(this)} type="text"
                            placeholder={'Search ' + filteredFields.length + ' fields'} />
                    </div>
                </div>
                <div className={styles.filters}>
                    {this.renderTypeFilter()}
                    {this.renderDatasourceFilter()}
                </div>
            </form>
        );

        let searchResults = filteredFields.concat([]);

        if (currentFieldSearchValue) {
            searchResults = [];

            filteredFields.forEach((item) => {
                const copy = Object.assign({}, item);
                copy.occurrenceIndex = copy.path.toLowerCase().indexOf(currentFieldSearchValue.toLowerCase());

                if (copy.occurrenceIndex !== -1) {
                    searchResults.push(copy);
                }
            });

            // Sort by when the search term occurs in the field name (the earlier the better)
            searchResults.sort((a, b) => a.occurrenceIndex - b.occurrenceIndex);
        }

        let numMore = null;
        let showMore = null;
        if (searchResults.length > maxSearchResults) {
            numMore = (
                <p key={1}>
                    {searchResults.length - maxSearchResults} more fields
                </p>
            );

            showMore = (
                <button onClick={() => this.handleMaxSearchResultsChange(maxSearchResults + 20)} key={2}>
                    Show more
                </button>
            );
        }

        let showLess = null;
        if (maxSearchResults > this.defaultMaxSearchResults) {
            showLess = (
                <button
                    className="showLess"
                    onClick={() => this.handleMaxSearchResultsChange(this.defaultMaxSearchResults)}
                    key={3}>
                    Show less
                </button>
            );
        }

        let noResults = null;
        if (searchResults.length === 0) {
            noResults = (
                <p>No fields found</p>
            );
        }

        const firstX = searchResults.slice(0, maxSearchResults);
        const available = ([
            <ul key={1}>
                {firstX.map((item, i) => {
                    return (
                        <FieldComponent
                            key={'available_fields_' + item.path + i}
                            item={item} handler={() => this.handleAddField(item)}
                            icon={'ion-ios-plus'}
                        />
                    );
                })}
            </ul>,
            <div className="searchResultsFooter" key={2}>
                {numMore}
                {showMore}
                {showLess}
                {noResults}
            </div>
        ]);

        let selectDatasourceMessage = null;

        if (filteredFields.length === 0 && fields.length === 0) {
            selectDatasourceMessage = <p>First select a datasource.</p>;
        }

        return (
            <div>
                <ul onMouseLeave={this.removeHighlightNodes.bind(this)}>
                    { options }
                </ul>
                { availableFields.length > 0 ? search : null }
                { availableFields.length > 0 ? available : null }
                { selectDatasourceMessage }
            </div>
        );
    }

    getAtLeastOneAlert() {
        return (
            <span className="heading-alert">
                Select at least one
            </span>
        );
    }

    onSelectIcon(field: Field, icon: string) {
        const { dispatch } = this.props;

        dispatch(fieldUpdate(field.path, {
            icon: icon
        }));

        this.setState({
            iconSelectorField: null
        });
    }

    render() {
        const { fields, datasources, availableFields, fieldsFetching } = this.props;

        return (
            <div className="form-group">
                <h2>
                    Fields
                    <Loader show={fieldsFetching} />
                    {datasources.length > 0 && fields.length === 0 ? this.getAtLeastOneAlert() : null}
                </h2>

                { this.renderFields(fields, availableFields) }
            </div>
        );
    }
}


function select(state) {
    return {
        fields: state.entries.fields,
        availableFields: state.fields.availableFields,
        date_fields: state.entries.date_fields,
        fieldsFetching: state.fields.fieldsFetching,
        datasources: state.datasources.datasources,
    };
}


export default connect(select)(Fields);