import {Node} from "../interfaces/node";
import {Link} from "../interfaces/link";

export default function getLinksForDisplay(nodes: Node[], links: Link[]): Link[] {
    const linksForDisplay: Link[] = [];

    links.forEach(link => {
        const source = nodes.find(node => node.display && node.id === link.source);
        const target = nodes.find(node => node.display && node.id === link.target);
        const display: boolean = typeof source !== 'undefined' && typeof target !== 'undefined';

        const newLink: Link = Object.assign({}, link, {
            display: display
        });

        linksForDisplay.push(newLink);
    });

    return linksForDisplay;
}