'use strict';

/**
 * Dependencies.
 */

var emoji,
    nlcstToString;

emoji = require('./data/emoji.json');
nlcstToString = require('nlcst-to-string');

/**
 * Cached methods.
 */

var has;

has = Object.prototype.hasOwnProperty;

/**
 * Constants: node types.
 */

var EMOTICON_NODE;

EMOTICON_NODE = 'EmoticonNode';

/**
 * Constants: magic numbers.
 *
 * Gemoji's are treated by a parser as multiple nodes.
 * Because this modifier walks backwards, the first colon
 * never matches a gemoji it would normaly walk back to
 * the beginning (the first node). However, because the
 * longest gemoji is tokenized as `Punctuation` (`:`),
 * `Punctuation` (`+`), `Word` (`1`), and `Punctuation`
 * (`:`), we can safely break when the modifier walked
 * back more than 4 times.
 */

var MAX_GEMOJI_PART_COUNT;

MAX_GEMOJI_PART_COUNT = 12;

/**
 * Constants for emoji.
 */

var index,
    names,
    shortcodes,
    unicodes,
    unicodeKeys;

names = emoji.names;
unicodeKeys = emoji.unicode;

/**
 * Quick access to short-codes.
 */

unicodes = {};

index = -1;

while (unicodeKeys[++index]) {
    unicodes[unicodeKeys[index]] = true;
}

shortcodes = {};

index = -1;

while (names[++index]) {
    shortcodes[':' + names[index] + ':'] = true;
}

/**
 * Merge emoji and github-emoji (punctuation marks,
 * symbols, and words) into an `EmoticonNode`.
 *
 * @param {CSTNode} child
 * @param {number} index
 * @param {CSTNode} parent
 * @return {undefined|number} - Either void, or the
 *   next index to iterate over.
 */

function mergeEmoji(child, index, parent) {
    var siblings,
        siblingIndex,
        node,
        nodes,
        value;

    siblings = parent.children;

    if (child.type === 'WordNode') {
        value = nlcstToString(child);

        /**
         * Sometimes a unicode emoji is marked as a
         * word. Mark it as an `EmoticonNode`.
         */

        if (has.call(unicodes, value)) {
            siblings[index] = {
                'type': EMOTICON_NODE,
                'value': value
            };
        } else {
            /**
             * Sometimes a unicode emoji is split in two.
             * Remove the last and add its value to
             * the first.
             */

            node = siblings[index - 1];

            if (
                node &&
                has.call(unicodes, nlcstToString(node) + value)
            ) {
                node.type = EMOTICON_NODE;
                node.value = nlcstToString(node) + value;

                siblings.splice(index, 1);

                return index;
            }
        }
    } else if (has.call(unicodes, nlcstToString(child))) {
        child.type = EMOTICON_NODE;
    } else if (nlcstToString(child) === ':') {
        nodes = [];
        siblingIndex = index;

        while (siblingIndex--) {
            if ((index - siblingIndex) > MAX_GEMOJI_PART_COUNT) {
                return;
            }

            node = siblings[siblingIndex];

            if (node.children) {
                nodes = nodes.concat(node.children.concat().reverse());
            } else {
                nodes.push(node);
            }

            if (nlcstToString(node) === ':') {
                break;
            }

            if (siblingIndex === 0) {
                return;
            }
        }

        nodes.reverse().push(child);

        value = nlcstToString({
            'children': nodes
        });

        if (!has.call(shortcodes, value)) {
            return;
        }

        siblings.splice(siblingIndex, index - siblingIndex);

        child.type = EMOTICON_NODE;
        child.value = value;

        return siblingIndex + 1;
    }
}

var emojiModifier;

function attach(parser) {
    if (!parser || !parser.parse) {
        throw new Error(
            '`parser` is not a valid parser for ' +
            '`attach(parser)`. Make sure something ' +
            'like `parse-latin` is passed.'
        );
    }

    /**
     * Make sure to not re-attach the modifier.
     */

    if (!emojiModifier) {
        emojiModifier = parser.constructor.modifier(mergeEmoji);
    }

    parser.useFirst('tokenizeSentence', emojiModifier);
}

/**
 * Expose `attach`.
 */

module.exports = attach;
