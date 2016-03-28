define( [ 'jquery', 'enketo-js/Widget', 'file-manager' ], function( $, Widget, fileManager ) {
    "use strict";

    var pluginName = 'filepicker';

    /**
     * FilePicker that works both offline and online. It abstracts the file storage/cache away
     * with the injected fileManager.
     *
     * @constructor
     * @param {Element} element [description]
     * @param {(boolean|{touch: boolean, maxlength:number})} options options
     * @param {*=} e     event
     */

    function Filepicker( element, options, e ) {
        if ( e ) {
            e.stopPropagation();
            e.preventDefault();
        }
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    // copy the prototype functions from the Widget super class
    Filepicker.prototype = Object.create( Widget.prototype );

    // ensure the constructor is the new one
    Filepicker.prototype.constructor = Filepicker;

    /**
     * Initialize
     */
    Filepicker.prototype._init = function() {
        var $input = $( this.element ),
            existingFileName = $input.attr( 'data-loaded-file-name' ),
            that = this;

        this.mediaType = $input.attr( 'accept' );
        if (! this.mediaType) this.mediaType = $input.attr( 'data' );

        $input
            .attr( 'disabled', 'disabled' )
            .addClass( 'transparent' )
            .parent().addClass( 'with-media clearfix' );

        this.$widget = $(
                '<div class="widget file-picker">' +
                '<div class="fake-file-input"></div>' +
                '<div class="file-feedback"></div>' +
                '</div>' )
            .insertAfter( $input );
        var $filePreview = $('<div class="file-preview"></div>');
        $filePreview.insertAfter($input.parent());
        this.$feedback = this.$widget.find( '.file-feedback' );
        this.$preview = $filePreview;
        var $downloadLink = $('<span class="get_image_link"></span>');
        $downloadLink.insertAfter(this.$preview);
        this.$downloadLink = $downloadLink;
        this.$fakeInput = this.$widget.find( '.fake-file-input' );
        this.$deleteButton = $('<button class="remove-file"> Remove </button>');

        Filepicker.prototype._showRemoveButton = function( preview, $input) {
           var that = this;
           that.$deleteButton.insertAfter(preview);
           that.$deleteButton.click(function(){
                $input.val( '' );
                that._showPreview( null );
                that._showFileName( null );
                that.$deleteButton.remove();
                $input.removeAttr( 'data-loaded-file-name' );
                $input.trigger( 'change.file' );
                that.$downloadLink.remove();
           });

        };
        // show loaded file name regardless of whether widget is supported
        this.showDownloadLinkAndPreview = function(existingFileName){
            var submission_id = $('document').context.defaultView.surveyResponseId;
            var location_image = "/download/attachment/"+submission_id+"/";
            if (this.mediaType == "image/*"){
                this._showPreview(location_image+"preview_"+existingFileName, this.mediaType);
            }
            this.$downloadLink.append('<a href="'+location_image+existingFileName+'" class="get_image_link">'+'Download file'+'</a>');
            this._showRemoveButton(this.$preview, $input);
        };


        // show loaded file name regardless of whether widget is supported
        if ( existingFileName ) {
            this._showFileName( existingFileName, this.mediaType );
            this.showDownloadLinkAndPreview(existingFileName);

        }

        if ( !fileManager || !fileManager.isSupported() ) {
            var advice = ( fileManager.notSupportedAdvisoryMsg ) ? fileManager.notSupportedAdvisoryMsg : '';
            this._showFeedback( 'Media questions are not supported in this browser. ' + advice, 'warning' );
            return;
        }

        if ( fileManager.isWaitingForPermissions() ) {
            this._showFeedback( 'Waiting for user permissions.', 'warning' );
        }

        fileManager.init()
            .then( function() {
                that._showFeedback();
                that._changeListener();
                $input.removeAttr( 'disabled' );
                if ( existingFileName ) {
                    fileManager.getFileUrl( existingFileName )
                        .then( function( url ) {
                            that._showPreview( url, that.mediaType );
                        } )
                        .catch( function() {
                            that._showFeedback( 'File "' + existingFileName + '" could not be found (leave unchanged if already submitted and you want to preserve it).', 'error' );
                        } );
                }
            } )
            .catch( function( error ) {
                that._showFeedback( error.message, 'error' );
            } );
    };

    Filepicker.prototype._getMaxSubmissionSize = function() {
        var maxSize = $( document ).data( 'maxSubmissionSize' );
        return maxSize || 5 * 1024 * 1024;
    };

    Filepicker.prototype._changeListener = function() {
        var that = this;
        var old_files;
        this.element.onclick = function(){
//            storing the previously selected file to use when upload cancelled
            old_files = $( this )[0].files;
            return true;
        };

        $( this.element ).on( 'change.propagate.' + this.namespace, function( event ) {
            var file, fileName,
                $input = $( this ),
                loadedFileName = $input.attr( 'data-loaded-file-name' );

            // get the file
            file = this.files[ 0 ];

            // To handle cancel issue on webkit browsers
            if (file == undefined) {
                event.stopPropagation();
                if ($input.val()==''){
                    that.$preview.empty();
                    that.$deleteButton.remove();
                    that.$downloadLink.remove();
                    $(this).removeAttr( 'data-loaded-file-name' );
                    that._showFileName( null );
                    $input.trigger( 'change.file' );
                }
                else {
                    $( this )[0].files = old_files;
                }
                event.preventDefault();
                return false;
            }
            // trigger eventhandler to update instance value
            if ( event.namespace === 'propagate' ) {
                $input.trigger( 'change.file' );
                return false;
            } else {
                event.stopImmediatePropagation();
            }

            // get the file
            file = this.files[ 0 ];
            fileName = that._getFileName( file );

            // process the file
            fileManager.getFileUrl( file )
                .then( function( url ) {
                    // update UI
                    that._showPreview( url, that.mediaType );
                    that._showRemoveButton(that.$preview, $input);
                    that._showFeedback( '' );
                    that._showFileName( fileName );
                    if ( loadedFileName && loadedFileName !== fileName ) {
                        $input.removeAttr( 'data-loaded-file-name' );
                    }
                    // update record
                    $input.trigger( 'change.propagate' );
                } )
                .catch( function( error ) {
                    // update record to clear any existing valid value
                    $input.val( '' ).trigger( 'change.propagate' );
                    // update UI
                    that._showFileName( '' );
                    that._showPreview( null );
                    that._showFileName( null );
                    that._showFeedback( error.message, 'error' );
                    $input.trigger( 'change.passthrough' );
                } );
        } );
    };

    Filepicker.prototype._getFileName = function( file ) {
        return ( typeof file === 'object' && file.name ) ? file.name : '';
    };

    Filepicker.prototype._showFileName = function( fileName ) {
        this.$fakeInput.text( fileName );
    };

    Filepicker.prototype._showFeedback = function( message, status ) {
        message = message || '';
        status = status || '';
        // replace text and replace all existing classes with the new status class
        this.$feedback.text( message ).attr( 'class', 'file-feedback ' + status );
    };

    Filepicker.prototype._showPreview = function( url, mediaType ) {
        var $el;



        switch ( mediaType ) {
            case 'image/*':
                $el = $( '<img />' );
                break;
            case 'audio/*':
                $el = $( '<audio controls="controls"/>' );
                break;
            case 'video/*':
                $el = $( '<video controls="controls"/>' );
                break;
            default:
                $el = $( '<span>No preview for this mediatype</span>' );
                break;
        }
        this.$preview.empty();
        if ( url ) {
//            Clearing preview before updating
            this.$downloadLink.empty();
            this.$preview.append( $el.attr( 'src', url ) );
        }
    };

    $.fn[ pluginName ] = function( options, event ) {

        options = options || {};

        return this.each( function() {
            var $this = $( this ),
                data = $this.data( pluginName );

            //only instantiate if options is an object (i.e. not a string) and if it doesn't exist already
            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, ( data = new Filepicker( this, options, event ) ) );
            }
            //only call method if widget was instantiated before
            else if ( data && typeof options == 'string' ) {
                //pass the element as a parameter as this is used in fix()
                data[ options ]( this );
            }
        } );
    };

} );
