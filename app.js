requirejs.config( {
    baseUrl: "../lib",
    paths: {
        "enketo-js": "../src/js",
        "enketo-widget": "../src/widget",
        "enketo-config": "../config.json",
        "text": "text/text",
        "xpath": "xpath/build/xpathjs_javarosa",
        "file-manager": "file-manager/src/file-manager",
        "jquery.xpath": "jquery-xpath/jquery.xpath",
        "jquery.touchswipe": "jquery-touchswipe/jquery.touchSwipe",
        "leaflet": "leaflet/leaflet",
        "bootstrap-slider": "bootstrap-slider/js/bootstrap-slider"
    },
    shim: {
        "xpath": {
            exports: "XPathJS"
        },
        "bootstrap": {
            deps: [ "jquery" ],
            exports: "jQuery.fn.popover"
        },
        "widget/date/bootstrap3-datepicker/js/bootstrap-datepicker": {
            deps: [ "jquery" ],
            exports: "jQuery.fn.datepicker"
        },
        "widget/time/bootstrap3-timepicker/js/bootstrap-timepicker": {
            deps: [ "jquery" ],
            exports: "jQuery.fn.timepicker"
        },
        "Modernizr": {
            exports: "Modernizr"
        },
        "leaflet": {
            exports: "L"
        }
    }
} );

define('jquery', [], function() {
    return jQuery;
});

//Hack to not include generated bootstrap files but use the one included by datawinners htmls
define('bootstrap', [], function() {
    return jQuery;
});

requirejs( [ 'jquery', 'Modernizr', 'enketo-js/Form' ],
    function( $, Modernizr, Form ) {
        var loadErrors, form;

        //if querystring touch=true is added, override Modernizr
        if ( getURLParameter( 'touch' ) === 'true' ) {
            Modernizr.touch = true;
            $( 'html' ).addClass( 'touch' );
        }

        var $data;
        data = xform_xml.replace( /jr\:template=/gi, 'template=' );
        $data = $( $.parseXML( data ) );
        $($data.find( 'form:eq(0)' )[0]).find("#form-title").remove();

        formStr = ( new XMLSerializer() ).serializeToString( $data.find( 'form:eq(0)' )[ 0 ] );
        modelStr = ( new XMLSerializer() ).serializeToString( $data.find( 'model:eq(0)' )[ 0 ] );

        $( '#validate-form' ).before( formStr );
        initializeForm();
        $("form").trigger("postFormLoadAction");

        //validate handler for validate button
        $( '#validate-form' ).on( 'click', function() {
            form.validate();
            if ( !form.isValid() ){
//                alert( 'Form contain errors. Please see fields marked in red.' );
            }
            else
            {
                DW.loading();
                var data = form.getDataStr();
                var saveURL= submissionUpdateUrl || submissionCreateUrl;

                var success = function(data, status){
                    window.location.replace(surveyResponseId === '' ? submissionURL : submissionLogURL);
                };
                $.post(saveURL,{'form_data':data}).done(success);
            }
        });

        //initialize the form

        function initializeForm() {
            form = new Form( 'form.or:eq(0)', modelStr, dataStrToEdit );
            //for debugging
            window.form = form;
            //initialize form and check for load errors
            loadErrors = form.init();
            if ( loadErrors.length > 0 ) {
                alert( 'loadErrors: ' + loadErrors.join( ', ' ) );
            }
        }

        //get query string parameter

        function getURLParameter( name ) {
            return decodeURI(
                ( RegExp( name + '=' + '(.+?)(&|$)' ).exec( location.search ) || [ , null ] )[ 1 ]
            );
        }
    } );
