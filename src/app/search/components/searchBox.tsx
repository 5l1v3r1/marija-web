import * as React from 'react';
import { connect, Dispatch } from 'react-redux';
import { Datasource } from '../../datasources/interfaces/datasource';
import { Node } from '../../graph/interfaces/node';
import { AppState } from '../../main/interfaces/appState';
import Icon from '../../ui/components/icon';
import { Search } from '../interfaces/search';
import Query from './query';
import * as styles from './searchBox.scss';
import { getActiveNonLiveDatasources } from '../../datasources/datasourcesSelectors';
import DateFilter from './dateFilter/dateFilter';
import { injectIntl, InjectedIntl, FormattedMessage } from 'react-intl';
import * as Fuse from 'fuse.js';

interface Props {
    onSubmit: Function;
    dispatch: Dispatch<any>;
    enabled: boolean;
    searches: Search[];
    nodes: Node[];
    datasources: Datasource[];
    queryHistory: string[];
    intl: InjectedIntl;
}

interface State {
    query: string;
    searchAroundOpen: boolean;
	noDatasourcesError: boolean;
	formExpanded: boolean;
	dateFilter: string;
	autoComplete: string[];
	activeAutoCompleteIndex: number;
}

class SearchBox extends React.Component<Props, State> {
    state: State = {
        query: '',
        searchAroundOpen: false,
        noDatasourcesError: false,
		formExpanded: false,
		dateFilter: '',
		autoComplete: [],
		activeAutoCompleteIndex: 0
    };
    searchForm: HTMLFormElement;
    queryInput: HTMLTextAreaElement;
    clickHandlerRef;
    queryHistorySearch: Fuse;

    setNoDatasourcesError(datasources: Datasource[]) {
        const { query } = this.state;

        this.setState({
            noDatasourcesError: !!query && datasources.length === 0
        });
    }

    onInputFocus() {
    	const { queryHistory } = this.props;
    	const { query } = this.state;

        this.clickHandlerRef = this.collapseForm.bind(this);
        this.adjustInputHeight();

        if (!query) {
			this.setState({
				autoComplete: queryHistory.slice(0, 5)
			});
		}

		this.setState({
			formExpanded: true
		});

        window.addEventListener('click', this.clickHandlerRef)
    }

    adjustInputHeight() {
		const maxHeight = 300;

		this.queryInput.style.height = 'auto';
		requestAnimationFrame(() => {
			this.queryInput.style.height = Math.min(this.queryInput.scrollHeight, maxHeight) + 'px';
		});
    }

    resetInputHeight() {
		this.queryInput.style.height = 'auto';
    }

    collapseForm(e) {
        if (this.searchForm && !this.searchForm.contains(e.target)) {
            // User clicked outside the search form, close it
            this.queryInput.blur();
            this.resetInputHeight();
            this.setState({
				formExpanded: false,
				autoComplete: []
			});

            window.removeEventListener('click', this.clickHandlerRef);
        }
    }

    handleSubmit(e) {
        e.preventDefault();

        const { query, dateFilter } = this.state;
        const { datasources } = this.props;

        const trimmed = query.trim();

        if (trimmed === '' || datasources.length === 0) {
            return;
        }

        this.setState({
			query: '',
			formExpanded: false,
			autoComplete: [],
			activeAutoCompleteIndex: 0
        });
		this.adjustInputHeight();
        this.props.onSubmit(trimmed, dateFilter);
    }

    handleQueryChange(event) {
    	const { datasources, queryHistory } = this.props;

    	const value = event.target.value;

    	let autoComplete = [];

    	if (value) {
    		const results: any = this.queryHistorySearch.search(value).slice(0, 10);

    		autoComplete = results.map(result => result.query);
		} else {
    		autoComplete = queryHistory.slice(0, 5);
		}

		this.setState({
			query: value,
			noDatasourcesError: !!value && datasources.length === 0,
			autoComplete
		});

		this.adjustInputHeight();
    }

    handleQueryKeyDown(event) {
    	const { autoComplete, activeAutoCompleteIndex } = this.state;

    	// Enter
		if (event.keyCode === 13 && !event.shiftKey) {
			this.handleSubmit(event);
			return;
		}

		if (!autoComplete.length) {
			return;
		}

		// Down
		if (event.keyCode === 40) {
			let newIndex: number;

			if (autoComplete.length === activeAutoCompleteIndex) {
				newIndex = 1;
			} else {
				newIndex = activeAutoCompleteIndex + 1;
			}

			this.setState({
				activeAutoCompleteIndex: newIndex,
				query: autoComplete[newIndex - 1]
			});
		} else {
			this.setState({
				activeAutoCompleteIndex: 0
			});
		}
    }

    toggleSearchAroundContainer() {
        const { searchAroundOpen } = this.state;

        this.setState({
            searchAroundOpen: !searchAroundOpen
        });
    }

    componentWillReceiveProps(nextProps: Props) {
		this.setNoDatasourcesError(nextProps.datasources);

		const searchable = nextProps.queryHistory.map(query => ({
			query
		}));

		this.queryHistorySearch = new Fuse(searchable, {
			keys: ['query']
		});
	}

	toggleFormExpanded() {
    	this.setState({
			formExpanded: !this.state.formExpanded
		});
	}

	handleDateFilterChange(date: string) {
    	this.setState({
			dateFilter: date
		});
	}

	onClickAutoComplete(query: string) {
    	this.setState({
			autoComplete: [],
			query: query,
			activeAutoCompleteIndex: 0
		}, () => {
    		requestAnimationFrame(() => {
				this.queryInput.focus()
			});
		});
	}

    render() {
        const { searches, nodes, intl } = this.props;
        const { query, searchAroundOpen, noDatasourcesError, formExpanded, dateFilter, autoComplete, activeAutoCompleteIndex } = this.state;

        const userQueries = searches
            .filter(search => search.aroundNodeId === null)
            .map(search =>
                <Query search={search} key={search.searchId} nodes={nodes} />
            );

        const searchAroundQueries = searches
            .filter(search => search.aroundNodeId !== null)
            .map(search =>
                <Query search={search} key={search.searchId} nodes={nodes} />
            );

        const searchAroundLoading = searches
            .filter(
                search => !search.completed && search.aroundNodeId !== null
            ).length > 0
            && !searchAroundOpen;

        let searchAroundContainer = null;
        if (searchAroundQueries.length > 0) {
            searchAroundContainer = (
                <div className={
                        'searchAroundContainer'
                        + (searchAroundOpen ? ' opened' : '')}>
                    <div className={'loaderContainer' + (searchAroundLoading ? ' loading' : '')} />

                    <h1 onClick={this.toggleSearchAroundContainer.bind(this)}>
                        Search around
                        <span className="num">{searchAroundQueries.length}</span>
                        <Icon name={searchAroundOpen ? 'ion-ios-arrow-up' : 'ion-ios-arrow-down'} />
                    </h1>

                    <div className={'queries' + (searchAroundOpen ? '' : ' hidden')}>
                        {searchAroundQueries}
                    </div>
                </div>
            );
        }

        const formClass = styles.form + (formExpanded ? '' : ' ' + styles.formCollapsed);

        return (
            <nav id="searchbox" role="navigation" ref="header">
                <div className={styles.queriesContainer}>
                    <div className={styles.formWrapper}>
                        <form onSubmit={this.handleSubmit.bind(this)} className={formClass} ref={form => this.searchForm = form}>
							<textarea
								ref={ref => this.queryInput = ref}
								className={styles.queryInput + (noDatasourcesError ? ' ' + styles.noDatasources : '')}
								placeholder={intl.formatMessage({ id: 'search' })}
								rows={1}
								value={ query }
								onChange={this.handleQueryChange.bind(this)}
								onKeyDown={this.handleQueryKeyDown.bind(this)}
								onFocus={this.onInputFocus.bind(this)}
							/>
							{noDatasourcesError && (
								<span className={styles.noDatasourcesMessage}><FormattedMessage id="activate_at_least_one_datasource" /></span>
							)}

							{autoComplete.length > 0 && (
								<ul className={styles.autoComplete}>
									{autoComplete.map((query, index) =>
										<li
											key={query}
											className={styles.autoCompleteQuery + (activeAutoCompleteIndex - 1 === index ? ' ' + styles.autoCompleteQueryActive : '')}
											onClick={() => this.onClickAutoComplete(query)}>
											{query}
										</li>
									)}
								</ul>
							)}

							{formExpanded && (
								<div className={styles.dates}>
									<DateFilter date={dateFilter} onChange={this.handleDateFilterChange.bind(this)}/>
								</div>
							)}

							<Icon name="ion-ios-search" className={'ion-ios-search ' + styles.searchIcon} />
                        </form>
                    </div>

                    {searchAroundContainer}
                    {userQueries}
                </div>
            </nav>
        );
    }
}

const select = (state: AppState, ownProps) => {
    return {
        ...ownProps,
        searches: state.graph.searches,
        datasources: getActiveNonLiveDatasources(state),
        nodes: state.graph.nodes,
		queryHistory: state.graph.queryHistory
    };
};

export default injectIntl(connect(select)(SearchBox));