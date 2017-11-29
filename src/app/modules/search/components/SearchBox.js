import React, { Component } from 'react';
import classNames from 'classnames/bind';

import { map } from 'lodash';
import Loader from "../../../components/Misc/Loader";
import {Queries} from "../../../components/index";

export default class SearchBox extends Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            q: props.q,
            selectValue: this.props.indexes[0]
        };
    }

    handleSubmit(e) {
        e.preventDefault();

        let q = this.refs.q.value;
        if (!q) {
            return;
        }

        this.props.onSubmit(q, this.state.selectValue);
    }

    render() {
        const { itemsFetching, indexes, connected } = this.props;

        return (
            <nav id="searchbox" className="[ navbar ][ navbar-bootsnipp animate ] row" role="navigation">
                <div className="logo-container">
                    <img className={`logo ${connected ? 'connected' : 'not-connected'}`} src="/images/logo.png" title={connected ? "Marija is connected to the backendservice" : "No connection to Marija backend available" } />
                </div>
                <div className="queries-container">
                    <Queries />
                </div>
                <div className="search-container">
                    <div className="form-group">
                        <form onSubmit={this.handleSubmit.bind(this)}>
                            <input ref="q" className="form-control" placeholder="Search something" value={ this.state.q }/>
                            <Loader show={itemsFetching} classes={['sk-search-box__loader']}/>
                        </form>
                    </div>
                </div>
            </nav>
        );
    }
}
