( function( tinymce, wp, _ ) {
	tinymce.PluginManager.add( 'block', function( editor ) {
		var element;

		// Set focussed block. Global variable for now. Top-level node for now.

		editor.on( 'nodechange', function( event ) {
			element = window.element = event.parents[ event.parents.length - 1 ];
		} );

		// Global controls

		function isNodeEligibleForControl( node, name ) {
			var block;

			if ( ! node ) {
				return false;
			}

			block = wp.blocks.getBlockSettingsByElement( node );
			return block && _.includes( block.controls, name );
		}

		_.forEach( wp.blocks.getControls(), function( control, name ) {
			var settings = {
				icon: control.icon
			};

			if ( control.onClick ) {
				settings.onClick = function() {
					control.onClick( element );
					editor.nodeChanged();
				};
			}

			if ( control.isActive ) {
				settings.onPostRender = function() {
					var button = this;

					editor.on( 'nodechange', function() {
						if ( isNodeEligibleForControl( element, name ) ) {
							button.active( control.isActive( element ) );
						}
					} );
				};
			}

			editor.addButton( name, settings );
		} );

		function addfigcaption() {
			if ( ! editor.$( element ).find( 'figcaption' ).length ) {
				var figcaption = editor.$( '<figcaption><br></figcaption>' );

				editor.undoManager.transact( function() {
					editor.$( element ).append( figcaption );
					editor.selection.setCursorLocation( figcaption[0], 0 );
				} );
			}
		}

		function removefigcaption() {
			var figcaption = editor.$( element ).find( 'figcaption' );

			if ( figcaption.length ) {
				editor.undoManager.transact( function() {
					figcaption.remove();
				} );
			}
		}

		editor.addButton( 'togglefigcaption', {
			icon: 'gridicons-caption',
			onClick: function() {
				if ( editor.$( element ).find( 'figcaption' ).length ) {
					removefigcaption();
				} else {
					addfigcaption();
				}
			},
			onPostRender: function() {
				var button = this;

				editor.on( 'nodechange', function( event ) {
					var element = event.parents[ event.parents.length - 1 ];

					button.active( editor.$( element ).find( 'figcaption' ).length > 0 );
				} );
			}
		} );

		// Attach block UI.

		editor.on( 'preinit', function() {
			var DOM = tinymce.DOM;
			var blockToolbar;
			var blockToolbars = {};

			// editor.addButton( 'moveblock', {
			// 	icon: 'gridicons-reblog',
			// 	onclick: function() {
			// 		editor.$( element ).attr( 'data-mce-selected', 'move' );
			// 		editor.$( editor.getBody() ).addClass( 'is-moving-block' );
			// 		editor.nodeChanged();
			// 	}
			// } );

			editor.addButton( 'block', {
				icon: 'gridicons-posts',
				tooltip: 'Add Block',
				onPostRender: function() {
					var button = this;

					editor.on( 'nodechange', function( event ) {
						var element = event.parents[ event.parents.length - 1 ];
						var settings = wp.blocks.getBlockSettingsByElement( element );

						if ( settings ) {
							button.icon( settings.icon );
						}
					} );
				}
			});

			function removeBlock() {
				var $blocks = editor.$( '*[data-mce-selected="block"]' ).add( element );
				var p = editor.$( '<p><br></p>' );

				editor.undoManager.transact( function() {
					$blocks.first().before( p );
					editor.selection.setCursorLocation( p[0], 0 );
					$blocks.remove();
				} );
			}

			editor.addButton( 'block-remove', {
				icon: 'gridicons-trash',
				onClick: removeBlock
			} );

			function moveBlockUp() {
				$blocks = getBlockSelection();
				rect = element.getBoundingClientRect();
				$prev = $blocks.first().prev();

				if ( $prev.length ) {
					editor.undoManager.transact( function() {
						$blocks.last().after( $prev );
					} );

					editor.nodeChanged();
					window.scrollBy( 0, - rect.top + element.getBoundingClientRect().top );
				}
			}

			function moveBlockDown() {
				$blocks = getBlockSelection();
				rect = element.getBoundingClientRect();
				$next = $blocks.last().next();

				if ( $next.length ) {
					editor.undoManager.transact( function() {
						$blocks.first().before( $next );
					} );

					editor.nodeChanged();
					window.scrollBy( 0, - rect.top + element.getBoundingClientRect().top );
				}
			}

			editor.addButton( 'up', {
				icon: 'gridicons-chevron-up',
				tooltip: 'Up',
				onClick: moveBlockUp,
				classes: 'widget btn move-up'
			} );

			editor.addButton( 'down', {
				icon: 'gridicons-chevron-down',
				tooltip: 'Down',
				onClick: moveBlockDown,
				classes: 'widget btn move-down'
			} );

			var insert = false;

			editor.addButton( 'add', {
				icon: 'gridicons-add-outline',
				tooltip: 'Add Block',
				onClick: function() {
					insert = true;
					editor.nodeChanged();
				}
			} );

			// Adjust icon of TinyMCE core buttons.
			editor.buttons.bold.icon = 'gridicons-bold';
			editor.buttons.italic.icon = 'gridicons-italic';
			editor.buttons.strikethrough.icon = 'gridicons-strikethrough';
			editor.buttons.link.icon = 'gridicons-link';

			var blockOutline = document.createElement( 'div' );

			blockOutline.className = 'block-outline';
			document.body.appendChild( blockOutline );

			var toolbarInline = editor.wp._createToolbar( [ 'bold', 'italic', 'strikethrough', 'link' ] );
			var toolbarCaret = editor.wp._createToolbar( [ 'add' ] );
			blockToolbar = editor.wp._createToolbar( [ 'up', 'down' ] );

			toolbarCaret.$el.addClass( 'block-toolbar' );
			blockToolbar.$el.addClass( 'block-toolbar' );

			function getInsertButtons() {
				var allSettings = wp.blocks.getBlocks();
				var buttons = [];
				var key;

				for ( key in allSettings ) {
					if ( allSettings[ key ].insert ) {
						buttons.push( {
							icon: allSettings[ key ].icon,
							onClick: allSettings[ key ].insert
						} );
					}
				}

				buttons.push( {
					text: 'Work in progress',
					onClick: function() {}
				} );

				return buttons;
			}

			var toolbarInsert = editor.wp._createToolbar( getInsertButtons() );

			var anchorNode;
			var range;
			var blockToolbarWidth = 0;

			toolbarInsert.reposition = function () {
				if ( ! element ) {
					return;
				}

				var toolbar = this.getEl();
				var toolbarRect = toolbar.getBoundingClientRect();
				var elementRect = element.getBoundingClientRect();
				var contentRect = editor.getBody().getBoundingClientRect();

				DOM.setStyles( toolbar, {
					position: 'absolute',
					left: contentRect.left + 100 + 'px',
					top: elementRect.top + window.pageYOffset + 'px'
				} );

				this.show();
			}

			toolbarInline.reposition = function () {
				if ( ! element ) {
					return;
				}

				var toolbar = this.getEl();
				var toolbarRect = toolbar.getBoundingClientRect();
				var elementRect = element.getBoundingClientRect();

				DOM.setStyles( toolbar, {
					position: 'absolute',
					left: elementRect.left + 8 + blockToolbarWidth + 'px',
					top: elementRect.top + window.pageYOffset - toolbarRect.height - 8 + 'px'
				} );

				this.show();
			}

			toolbarCaret.reposition =
			blockToolbar.reposition = function () {
				if ( ! element ) {
					return;
				}

				var toolbar = this.getEl();
				var toolbarRect = toolbar.getBoundingClientRect();
				var elementRect = element.getBoundingClientRect();

				var contentRect = editor.getBody().getBoundingClientRect();

				DOM.setStyles( toolbar, {
					position: 'absolute',
					left: contentRect.left + 50 + 'px',
					top: elementRect.top + window.pageYOffset + 'px'
				} );

				this.show();
			}

			editor.on( 'blur', function() {
				toolbarInline.hide();
				toolbarCaret.hide();
				hideBlockUI();
			} );

			function isEmptySlot( node, isAtRoot ) {
				// Text node.
				if ( node.nodeType === 3 ) {
					// Has text.
					if ( node.data.length ) {
						return false;
					} else {
						node = node.parentNode;
					}
				}

				// Element node.
				if ( node.nodeType === 1 ) {
					// Element is no direct child.
					if ( isAtRoot && node.parentNode !== editor.getBody() && node.nodeName !== 'P' ) {
						return false;
					}

					var childNodes = node.childNodes;
					var i = childNodes.length;

					// Loop over children.
					while ( i-- ) {
						// Text node.
						if ( childNodes[ i ].nodeType === 3 ) {
							// Has text.
							if ( childNodes[ i ].data.length ) {
								return false;
							}
						}

						// Element node.
						if ( childNodes[ i ].nodeType === 1 ) {
							// Is not BR.
							if ( childNodes[ i ].nodeName !== 'BR' ) {
								return false;
							}
						}
					}
				}

				return true;
			}

			var hasBlockUI = false;

			function hideBlockUI() {
				if ( hasBlockUI ) {
					tinymce.$( editor.getBody() ).removeClass( 'has-block-ui' );
					hasBlockUI = false;
				}

				toolbarInline.hide();
				blockToolbar.hide();

				tinymce.each( blockToolbars, function( toolbar ) {
					toolbar.hide();
				} );
			}

			function focusToolbar( toolbar ) {
				var node = toolbar.find( 'toolbar' )[0];
				node && node.focus( true );
			}

			function showBlockUI( focus ) {
				var settings = wp.blocks.getBlockSettingsByElement( element ),
					controls;

				if ( ! hasBlockUI ) {
					tinymce.$( editor.getBody() ).addClass( 'has-block-ui' );
					hasBlockUI = true;
				}

				blockToolbar.reposition();

				tinymce.each( blockToolbars, function( toolbar, key ) {
					if ( key !== settings._id ) {
						toolbar.hide();
					}
				} );

				if ( settings ) {
					if ( ! blockToolbars[ settings._id ] ) {
						controls = settings.controls || [];

						blockToolbars[ settings._id ] = editor.wp._createToolbar( controls );
						blockToolbars[ settings._id ].reposition = function () {
							if (!element) return

							var toolbar = this.getEl();
							var toolbarRect = toolbar.getBoundingClientRect();
							var elementRect = element.getBoundingClientRect();
							var contentRect = editor.getBody().getBoundingClientRect();

							DOM.setStyles( toolbar, {
								position: 'absolute',
								left: elementRect.left + 'px',
								top: elementRect.top + window.pageYOffset - toolbarRect.height - 8 + 'px'
							} );

							blockToolbarWidth = toolbarRect.width;

							this.show();
						}

						editor.nodeChanged(); // Update UI.
					}

					blockToolbars[ settings._id ].reposition();
					focus && focusToolbar( blockToolbars[ settings._id ] );

					if ( anchorNode.nodeType === 3 ) {
						toolbarInline.reposition();
					} else {
						toolbarInline.hide();
					}
				}
			}

			function isInputKeyEvent( event ) {
				var code = event.keyCode;
				var VK = tinymce.util.VK;

				if ( VK.metaKeyPressed( event ) ) {
					return false;
				}

				// Special keys.
				if ( code <= 47 && ! (
					code === VK.SPACEBAR || code === VK.ENTER || code === VK.DELETE || code === VK.BACKSPACE
				) ) {
					return false;
				}

				// OS keys.
				if ( code >= 91 && code <= 93 ) {
					return false;
				}

				// Function keys.
				if ( code >= 112 && code <= 123 ) {
					return false;
				}

				// Lock keys.
				if ( code >= 144 && code <= 145 ) {
					return false;
				}

				return true;
			}

			var hidden = true;
			var keypress = false;

			editor.on( 'keydown', function( event ) {
				keypress = true;

				if ( ! isInputKeyEvent( event ) ) {
					return;
				}

				// No typing directly on elements.
				if ( anchorNode.nodeType === 1 && ! isEmptySlot( anchorNode ) ) {
					event.preventDefault();
				} else {
					hidden = true;
				}

				insert = false;
			} );

			editor.on( 'keyup', function( event ) {
				keypress = false;
			} );

			editor.on( 'beforePastePreProcess beforeExecCommand', function( event ) {
				if ( anchorNode.nodeType === 1 && ! isEmptySlot( anchorNode ) ) {
					event.preventDefault();
				}
			} );

			editor.on( 'input', function( event ) {
				// Non key input (e.g. emoji).
				if ( keypress ) {
					return;
				}

				if ( anchorNode.nodeType === 1 && ! isEmptySlot( anchorNode ) ) {
					// Event not cancelable. :(
					// Let's see how this goes, it might be buggy.
					editor.undoManager.add();
					editor.undoManager.undo();
				}
			} );

			editor.on( 'mousedown touchstart', function() {
				hidden = false;
				insert = false;
			} );

			function getBlockSelection( selection ) {
				selection = selection || window.getSelection();

				if ( selection.anchorNode.compareDocumentPosition( selection.focusNode ) & Node.DOCUMENT_POSITION_FOLLOWING ) {
					var startNode = selection.anchorNode;
					var endNode = selection.focusNode;
				} else {
					var startNode = selection.focusNode;
					var endNode = selection.anchorNode;
				}

				var $start = editor.$( editor.dom.getParent( startNode, function( element ) {
					return element.parentNode === editor.getBody();
				} ) );

				var $end = editor.$( editor.dom.getParent( endNode, function( element ) {
					return element.parentNode === editor.getBody();
				} ) );

				return $start.add( $start.nextUntil( $end ) ).add( $end );
			}

			editor.on( 'selectionChange nodeChange', function( event ) {
				var selection = window.getSelection();
				var isCollapsed = selection.isCollapsed;

				if ( ! selection.anchorNode ) {
					return;
				}

				if ( selection.anchorNode.parentNode.id === 'mcepastebin' ) {
					return;
				}

				if ( ! editor.getBody().contains( selection.anchorNode ) ) {
					return;
				}

				anchorNode = selection.anchorNode;

				var isEmpty = isCollapsed && isEmptySlot( anchorNode, true );
				var isBlockUIVisible = ! hidden;

				if ( isEmpty ) {
					window.console.log( 'Debug: empty node.' );

					hideBlockUI();
					toolbarInline.hide();
					toolbarCaret.reposition();
				} else {
					toolbarCaret.hide();

					if ( isBlockUIVisible ) {
						var selectedBlocks = getBlockSelection();

						if ( selectedBlocks.length === 1 ) {
							showBlockUI();
						} else {
							hideBlockUI();
							blockToolbar.reposition();
						}

						var startRect = selectedBlocks.first()[0].getBoundingClientRect();
						var endRect = selectedBlocks.last()[0].getBoundingClientRect();

						DOM.setStyles( blockOutline, {
							position: 'absolute',
							left: Math.min( startRect.left, endRect.left ) + 'px',
							top: startRect.top + window.pageYOffset + 'px',
							height: endRect.bottom - startRect.top + 'px',
							width: Math.max( startRect.width, endRect.width ) + 'px'
						} );
					} else {
						hideBlockUI();
					}
				}

				if ( insert ) {
					toolbarInsert.reposition();
				} else {
					toolbarInsert.hide();
				}
			} );

			editor.on( 'nodeChange', function( event ) {
				insert = false;
			} );

			// editor.on( 'keydown', function( event ) {
			// 	if ( editor.$( element ).attr( 'data-mce-selected' ) === 'block' ) {
			// 		if ( event.keyCode === tinymce.util.VK.DOWN ) {
			// 			editor.execCommand( 'down' );
			// 			event.preventDefault();
			// 		}

			// 		if ( event.keyCode === tinymce.util.VK.UP ) {
			// 			editor.execCommand( 'up' );
			// 			event.preventDefault();
			// 		}
			// 	}
			// } );

			var metaCount = 0;

			editor.on( 'keydown', function( event ) {
				var keyCode = event.keyCode;
				var VK = tinymce.util.VK;

				if ( element.nodeName === 'FIGURE' ) {
					if ( keyCode === VK.ENTER ) {
						addfigcaption();
						event.preventDefault();
					}

					if ( keyCode === VK.BACKSPACE ) {
						var caretEl = editor.selection.getNode();

						if ( caretEl.nodeName !== 'FIGCAPTION' ) {
							removeBlock();
							event.preventDefault();
						} else {
							var range = editor.selection.getRng();

							if ( range.collapsed && range.startOffset === 0 ) {
								removefigcaption();
								event.preventDefault();
							}
						}
					}

					if ( keyCode === VK.LEFT ) {
						var range = editor.selection.getRng();

						if ( keyCode === VK.LEFT && range.startOffset === 0 ) {
							event.preventDefault();
						}
					}
				} else {
					if ( keyCode === VK.BACKSPACE ) {
						var selection = window.getSelection();

						if ( ! selection.isCollapsed && editor.dom.isBlock( selection.focusNode ) ) {
							if ( selection.anchorOffset === 0 && selection.focusOffset === 0 ) {
								if ( element.nextSibling && element.nextSibling.contains( selection.focusNode ) ) {
									removeBlock();
									event.preventDefault();
								}
							}

							if ( selection.anchorOffset === 0 && selection.anchorNode === selection.focusNode ) {
								removeBlock();
								event.preventDefault();
							}
						}
					}
				}

				if ( VK.metaKeyPressed( event ) ) {
					metaCount ++;
				} else {
					metaCount = 0;
				}

				if ( keyCode === 27 ) {
					hideBlockUI();
				}
			}, true );

			editor.on( 'keyup', function( event ) {
				if ( metaCount === 1 ) {
					showBlockUI( true );
				}

				metaCount = 0;
			} );

			editor.on( 'dragstart', function( event ) {
				if ( element.nodeName === 'FIGURE' ) {
					event.preventDefault();
				}
			} );
		} );
	} );
} )( window.tinymce, window.wp, window._ );
