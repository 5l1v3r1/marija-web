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
import {
	highlightNodes,
	nodesSelect,
	setTimelineGrouping
} from '../graphActions';
import {BarChart, XAxis, YAxis, Bar, Tooltip} from 'recharts';
import {Search} from "../../search/interfaces/search";
import {
	getNodesForDisplay,
	getTimelineGroups,
	TimelineGroups
} from "../graphSelectors";
import {AppState} from "../../main/interfaces/appState";
import {dateFieldAdd} from "../../fields/fieldsActions";
import TimelineSlider from './timelineSlider/timelineSlider';
import * as styles from './timeline.scss';
import { EventEmitter } from 'fbemitter';
import { TimelineGrouping } from '../interfaces/graphState';

interface Props {
	onPaneEvent?: EventEmitter;
    normalizations: Normalization[];
    availableFields: Field[];
    fields: Field[];
    date_fields: Field[];
    items: Item[];
    nodes: Node[];
    dispatch: Dispatch<any>;
    searches: Search[];
    timelineGroups: TimelineGroups;
	timelineGrouping: TimelineGrouping;
}

interface State {
    showAllFields: boolean;
}

class Timeline extends React.Component<Props, State> {
	isPlaying: boolean = false;
    state: State = {
        showAllFields: false
    };
	container;
	barChart;


    componentDidMount() {
        const { onPaneEvent } = this.props;

		onPaneEvent.addListener('resized', this.onResized.bind(this));
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
		const { periods, groups } = this.props.timelineGroups;

		return periods.map(period => {
			const data = {
				name: period
			};

			searchIds.forEach(searchId => {
				const nodes: Node[] = groups[period].filter(node => node.searchIds.indexOf(searchId) !== -1);

				data[searchId] = nodes.length
			});

			return data;
		});
    }

    getChart() {
        const { date_fields, items } = this.props;

        if (!items.length || !date_fields.length) {
            return;
        }

        const searchIds: string[] = this.getSearchIds();
        const chartData = this.getChartData(searchIds);
        const containerRect = this.container.getBoundingClientRect();

        return (
            <BarChart
				ref={ref => this.barChart = ref}
                width={containerRect.width}
                height={containerRect.height - 50}
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
                        stackId="a"
                        fill={this.getSearchColor(searchId)}
						isAnimationActive={false}
                    />
                )}
            </BarChart>
        );
    }

    private getNodes(period: string): Node[] {
        const { groups } = this.props.timelineGroups;

        return groups[period];
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

	onResized() {
        this.forceUpdate();
    }

    onGroupingChange(ev: FormEvent<HTMLSelectElement>) {
    	const { dispatch } = this.props;

    	dispatch(setTimelineGrouping(ev.currentTarget.value as TimelineGrouping));
	}

    render() {
        const { nodes, date_fields, timelineGrouping } = this.props;
        const { periods } = this.props.timelineGroups;

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

        const groupOptions: TimelineGrouping[] = [
        	'second',
			'minute',
			'hour',
			'day',
			'week',
			'month'
		];

        let grouping = null;
        let slider = null;

        if (!noNodes && !noDateFields) {
        	grouping = (
				<div className={styles.grouping}>
					<label className={styles.groupingLabel}>Group by</label>
					<select onChange={this.onGroupingChange.bind(this)} defaultValue={timelineGrouping} className={styles.selectGrouping}>
						{groupOptions.map(option => (
							<option value={option} key={option}>{option}</option>
						))}
					</select>
				</div>
			);

        	slider = (
				<div className={styles.sliderContainer}>
					<TimelineSlider
						playTime={periods.length * 600}
						playWindowWidth={Math.round(1 / periods.length * 100) / 100}
						onChange={this.onSliderChange.bind(this)}
						onStartPlaying={this.onStartPlaying.bind(this)}
						onFinishPlaying={this.onFinishPlaying.bind(this)}
					/>
				</div>
			);
		}

        return (
            <div ref={ref => this.container = ref} className={styles.componentContainer}>
                { this.selectDateFields() }
                { noNodes }
                { noDateFields }
                <div className={styles.chartContainer}>
                	{this.getChart()}
					{grouping}
					{slider}
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
        searches: state.graph.searches,
		timelineGrouping: state.graph.timelineGrouping,
        timelineGroups: getTimelineGroups(state)
    };
};

export default connect(select)(Dimensions()(Timeline));
