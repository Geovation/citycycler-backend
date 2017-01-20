// Based on http://www.dustinhorne.com/post/2016/06/08/implementing-a-dictionary-in-typescript

import * as _ from "lodash";

import { IKeyedCollection } from "../interfaces";

export class KeyedCollection<T> implements IKeyedCollection<T> {
    private items: { [index: string]: T } = {};
    public containsKey(key: string): boolean {
        return _.has(this.items, key);
    }
    public count(): number {
        return _.size(this.items);
    }
    public add(key: string, value: T) {
        this.items[key] = value;
    }
    public remove(key: string): T {
        // TODO: return a copy, not the original
        let val = this.items[key];
        delete this.items[key];
        return val;
    }
    public item(key: string): T {
        // TODO: return a copy, not the original
        return this.items[key];
    }
    public keys(): string[] {
        let keySet: string[] = [];
        _.each(_.keys(this.items), prop => keySet.push(prop));
        return keySet;
    }
    public values(): T[] {
        let values: T[] = [];
        _.each(_.values(this.items), value => values.push(value));
        return values;
    }
}
