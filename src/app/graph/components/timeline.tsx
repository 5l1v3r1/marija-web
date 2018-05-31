import * as React from 'react';
import {connect, Dispatch} from 'react-redux';
import { find, map, groupBy, reduce, forEach, filter, concat } from 'lodash';
import Dimensions from 'react-dimensions';
import * as moment from 'moment';
import fieldLocator from '../../fields/helpers/fieldLocator';
import {Normalization} from "../interfaces/normalization";
import {Field} from "../../fields/interfaces/field";
import {Item} from "../../items/interfaces/item";
import {Node} from "../interfaces/node";
import {Moment} from "moment";
import {FormEvent} from "react";
import {dateFieldDelete} from '../../fields/fieldsActions';
import {searchFieldsUpdate} from '../../search/searchActions';
import {highlightNodes, nodesSelect} from '../graphActions';
import {BarChart, XAxis, YAxis, Bar, Tooltip} from 'recharts';
import {Search} from "../../search/interfaces/search";
import {getNodesForDisplay} from "../graphSelectors";
import {AppState} from "../../main/interfaces/appState";
import {dateFieldAdd} from "../../fields/fieldsActions";
import TimelineSlider from './timelineSlider/timelineSlider';
import * as styles from './timeline.scss';

interface Props {
    normalizations: Normalization[];
    availableFields: Field[];
    fields: Field[];
    date_fields: Field[];
    items: Item[];
    nodes: Node[];
    containerWidth: number;
    containerHeight: number;
    dispatch: Dispatch<any>;
    searches: Search[];
}

interface State {
    showAllFields: boolean;
    groupedNodes: {
        [period: string]: Node[]
    };
    periods: string[]
}

class Timeline extends React.Component<Props, State> {
	isPlaying: boolean = false;
    state: State = {
        showAllFields: false,
        groupedNodes: {},
        periods: []
    };

    getDate(node: Node, items: Item[]): Moment | undefined {
        const { date_fields } = this.props;

        /**
         * Don't use forEach, because we want to be able to break out of the
         * loops as soon as we find a date.
         */
        for (let i = 0; i < node.items.length; i ++) {
            const item: Item = items.find(search => search.id === node.items[i]);

            for (let j = 0; j < date_fields.length; j ++) {
                const date: any = fieldLocator(item.fields, date_fields[j].path);

                if (date) {
                    return moment(date);
                }
            }
        }
    }

    setGroupsAndPeriods(nodes: Node[], items: Item[]) {
        const times: Moment[] = [];

        const groupedNodes = groupBy(nodes, (node: Node) => {
            const date: Moment = this.getDate(node, items);

            if (typeof date === 'undefined') {
                return 'unknown';
            }

            times.push(date);
            return date.year() + '-' + (date.month() + 1);
        });

        times.sort((a: Moment, b: Moment) => {
            return a.unix() - b.unix();
        });

        const periods: string[] = [];

        times.forEach(moment => {
            const string: string = moment.year() + '-' + (moment.month() + 1);

            if (periods.indexOf(string) === -1) {
                periods.push(string);
            }
        });

        this.setState({
            groupedNodes: groupedNodes,
            periods: periods
        });
    }

    componentWillReceiveProps(nextProps: Props) {
        if (nextProps.nodes.length !== this.props.nodes.length) {
            this.setGroupsAndPeriods(nextProps.nodes, nextProps.items);
        }
    }

    componentDidMount() {
        console.log(this.barChart);

        this.setGroupsAndPeriods(this.props.nodes, this.props.items);
    }

    handleFieldChange(event: FormEvent<HTMLInputElement>, field: Field) {
        const { dispatch } = this.props;

        if (event.currentTarget.checked) {
            dispatch(dateFieldAdd(field));
            dispatch(searchFieldsUpdate());
        } else {
            dispatch(dateFieldDelete(field));
        }
    }

    renderDateField(field: Field) {
        const { date_fields } = this.props;
        const isSelected: boolean = typeof date_fields.find(search =>
            search.path === field.path
        ) !== 'undefined';

        return (
            <label className="dateField" key={field.path}>
                <input
                    type="checkbox"
                    defaultChecked={isSelected}
                    onChange={event => this.handleFieldChange(event, field)}
                />
                <span>{field.path}</span>
            </label>
        );
    }

    selectDateFields() {
        const { availableFields } = this.props;
        const { showAllFields } = this.state;
        const availableDateFields = availableFields.filter(field => field.type === 'date');

        let toggleAllFieldsButton = null;

        if (availableDateFields.length > 10) {
            toggleAllFieldsButton = (
                <button
                    onClick={this.toggleAllFields.bind(this)}
                    className="toggleAllFields">
                    {showAllFields ? 'Show less' : 'Show all'}
                </button>
            );

            if (!showAllFields) {
                availableDateFields.splice(10);
            }
        }

        return (
            <div className="dateFields">
                {availableDateFields.map(field => this.renderDateField(field))}
                {toggleAllFieldsButton}
            </div>
        );
    }

    toggleAllFields() {
        this.setState({
            showAllFields: !this.state.showAllFields
        });
    }

    getSearchIds(): string[] {
		const { items } = this.props;

        return items.reduce((previous, item: Item) => {
			if (previous.indexOf(item.searchId) === -1) {
				return previous.concat([item.searchId]);
			}

			return previous;
		}, []);
    }

    getChartData(searchIds: string[]) {
		const { periods, groupedNodes } = this.state;

		return periods.map(period => {
			const data = {
				name: period
			};

			searchIds.forEach(searchId => {
				const nodes: Node[] = groupedNodes[period].filter(node => node.searchIds.indexOf(searchId) !== -1);

				data[searchId] = nodes.length
			});

			return data;
		});
    }

    getChart() {
        const { date_fields, items, containerHeight, containerWidth } = this.props;

        if (!items.length || !date_fields.length) {
            return;
        }

        const searchIds: string[] = this.getSearchIds();
        const chartData = this.getChartData(searchIds);

        return (
            <BarChart
				ref={ref => this.barChart = ref}
                width={containerWidth}
                height={containerHeight - 30}
                margin={{top: 0, right: 0, bottom: 0, left: 0}}
                data={chartData}>
                <XAxis dataKey="name" stroke="white" />
                <YAxis width={35} stroke="white" />
                <Tooltip
                    isAnimationActive={false}
                    wrapperStyle={{background: '#425269'}}
                    cursor={{fill: 'transparent'}}
                    formatter={value => value + ' nodes'}
                />
                {searchIds.map(searchId =>
                    <Bar
                        key={searchId}
                        dataKey={searchId}
                        onMouseEnter={this.mouseEnterBar.bind(this)}
                        onMouseLeave={this.mouseLeaveBar.bind(this)}
                        onMouseDown={this.mouseDownBar.bind(this)}
                        stackId="a"
                        fill={this.getSearchColor(searchId)}
                    />
                )}
            </BarChart>
        );
    }

    barChart;

    private getNodes(period: string): Node[] {
        const { groupedNodes } = this.state;

        return groupedNodes[period];
    }

    mouseEnterBar(bar) {
        const { dispatch } = this.props;
        const related = this.getNodes(bar.name);
        dispatch(highlightNodes(related));
    }

    mouseLeaveBar() {
        const { dispatch } = this.props;
        dispatch(highlightNodes([]));
    }

    mouseDownBar(bar) {
        const { dispatch } = this.props;
        const related = this.getNodes(bar.name);
        dispatch(nodesSelect(related));
    }

    getSearchColor(searchId: string): string {
        const { searches } = this.props;

        const search = searches.find(searchLoop => searchLoop.searchId === searchId);

        return search.color;
    }

    onSliderChange(minFraction: number, maxFraction: number) {
		const { dispatch } = this.props;

        const searchIds = this.getSearchIds();
        const chartData = this.getChartData(searchIds);

        const xAxis: SVGRect = this.container.querySelector('.recharts-xAxis line').getBBox();
		const minMiddlePoint: number = xAxis.width * minFraction + xAxis.x;
        const maxMiddlePoint: number = xAxis.width * maxFraction + xAxis.x;

        const bars: SVGRectElement[] = this.container.querySelectorAll('.recharts-bar-rectangle');
        const periods: string[] = [];

        bars.forEach((bar, index) => {
            const rect = bar.getBBox();
            const middlePoint = rect.x + rect.width / 2;

            if (middlePoint <= maxMiddlePoint && middlePoint >= minMiddlePoint) {
                periods.push(chartData[index].name);
            }
        });

		let nodes = [];

        periods.forEach(period =>
            nodes = nodes.concat(this.getNodes(period))
        );

        if (nodes.length || !this.isPlaying) {
        	// Dont highlight when there are no nodes while we're playing the
			// slider animation
			dispatch(highlightNodes(nodes));
		}
    }

    onStartPlaying() {
    	this.isPlaying = true;
	}

	onFinishPlaying() {
		this.isPlaying = false;
	}

    container;

    render() {
        const { nodes, date_fields } = this.props;
        const { periods } = this.state;

        let noNodes = null;
        if (nodes.length === 0) {
            noNodes = <p>No search results available.</p>;
        }

        let noDateFields = null;
        if (date_fields.length === 0) {
            noDateFields = (
                <p>Select at least one date field above.</p>
            );
        }

        let chart = null;
        if (!noDateFields && !noNodes) {
            chart = this.getChart();
        }

        return (
            <div ref={ref => this.container = ref}>
                { this.selectDateFields() }
                { noNodes }
                { noDateFields }
                <div className={styles.chartContainer}>
                	{ chart }
                	<div className={styles.sliderContainer}>
						<TimelineSlider
							playTime={periods.length * 600}
							playWindowWidth={Math.round(1 / periods.length * 100) / 100}
							onChange={this.onSliderChange.bind(this)}
							onStartPlaying={this.onStartPlaying.bind(this)}
							onFinishPlaying={this.onFinishPlaying.bind(this)}
						/>
					</div>
				</div>
            </div>
        );
    }
}

const select = (state: AppState, ownProps) => {
    return {
        ...ownProps,
        availableFields: state.fields.availableFields,
        nodes: getNodesForDisplay(state),
        fields: state.graph.fields,
        normalizations: state.graph.normalizations,
        date_fields: state.graph.date_fields,
        items: state.graph.items,
        searches: state.graph.searches
    };
};

export default connect(select)(Dimensions()(Timeline));
