$(document).ready(function() {

  $('#descriptionBody').fadeIn(1000);
  $('#contactBody').css('display', 'none');

  $('#workEx1').css('display', 'none');
  $('#workEx2').css('display', 'none');


  //Click Work
  $('#description').click(function() {
    event.preventDefault();

    $('#contactBody').hide();
    $('#descriptionBody').fadeIn(1000);

    $(this).addClass('active');
    $('#contact').removeClass('active');
  });

  //Click Contact
  $('#contact').click(function() {
    event.preventDefault();

    $('#descriptionBody').hide();
    $('#contactBody').fadeIn(1000);

    $('#description').removeClass('active');
    $(this).addClass('active');
  });

  //Click workEx1
  $('#workEx1').click(function() {
    event.preventDefault();

    $('#descriptionBody').hide();
    $('#workEx1').fadeIn(1000);
    //Bring person up to the top of the screen.
    // you need a

    $('#description').removeClass('active');
    $(this).addClass('active');
  });
});
